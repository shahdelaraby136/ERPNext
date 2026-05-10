/* Custom CRM Workspace Redesign — same brand theme as Selling/Buying.
   Hijacks /app/crm and renders Hero + KPIs + leads chart + lists.
   Data comes from Server Script: crm_dashboard_data
*/

(function () {
	const TAG = '[ce-crm]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isCrmPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'crm') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/crm' || p.startsWith('/app/crm/') || p.startsWith('/app/crm?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/crm')) return true;
			return false;
		} catch (e) { log('route check error', e); return false; }
	}

	let observer = null;
	let mounted = false;

	function findHost() {
		const candidates = [
			'.layout-main-section .desk-page',
			'.layout-main-section .codex-editor',
			'.layout-main-section .workspace-tab',
			'.layout-main-section .container',
			'.layout-main-section',
		];
		for (const sel of candidates) {
			const el = document.querySelector(sel);
			if (el) return { el, sel };
		}
		return null;
	}

	function ensureBodyFlag(on) {
		document.body.classList.toggle('ce-crm-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-crm-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-crm-root ce-theme-brand';
			layout.insertBefore(root, layout.firstChild);
		}
		ensureBodyFlag(true);
		render(root);
		mounted = true;
		return true;
	}

	function unmount() {
		mounted = false;
		ensureBodyFlag(false);
		document.querySelectorAll('.ce-crm-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-crm">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('CRM'))}</div>
							<h1 class="ce-hero-title">${esc(__('CRM Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-lead">🎯 ${esc(__('Lead'))}</button>
							<button class="btn ce-hero-btn" data-action="new-opportunity">💼 ${esc(__('Opportunity'))}</button>
							<button class="btn ce-hero-btn" data-action="new-customer">👤 ${esc(__('Customer'))}</button>
							<button class="btn ce-hero-btn" data-action="new-campaign">📣 ${esc(__('Campaign'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Pipeline pulse'))}</div>
					<div class="ds-grid" id="ce-crm-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-crm-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('New leads — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/lead">${esc(__('All leads'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-crm-leads-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Hot opportunities'))}</div>
								<a class="ce-panel-link" href="/app/opportunity">${esc(__('All opportunities'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-crm-hot-opps">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent leads'))}</div>
								<a class="ce-panel-link" href="/app/lead">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-crm-recent-leads">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open opportunities'))}</div>
								<a class="ce-panel-link" href="/app/opportunity?status=Open">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-crm-open-opps">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-crm-quick'));
		loadData(root);
	}

	function esc(s) {
		try { return frappe.utils.escape_html(s == null ? '' : String(s)); }
		catch (e) {
			return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
		}
	}

	function bindActions(root) {
		const newDoc = (dt) => () => frappe.new_doc(dt);
		const map = {
			'new-lead':        newDoc('Lead'),
			'new-opportunity': newDoc('Opportunity'),
			'new-customer':    newDoc('Customer'),
			'new-campaign':    newDoc('Campaign'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Lead'),         icon: '🎯', href: '/app/lead/new' },
			{ label: __('New Opportunity'),  icon: '💼', href: '/app/opportunity/new' },
			{ label: __('New Customer'),     icon: '👤', href: '/app/customer/new' },
			{ label: __('New Campaign'),     icon: '📣', href: '/app/campaign/new' },
			{ label: __('Contacts'),         icon: '📇', href: '/app/contact' },
			{ label: __('Email Campaigns'),  icon: '✉️', href: '/app/email-campaign' },
			{ label: __('Sales Funnel'),     icon: '🪜', href: '/app/dashboard-view' },
			{ label: __('Sales Analytics'),  icon: '📊', href: '/app/query-report/Sales Analytics' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function fmtMoney(v, currency) {
		try {
			if (typeof format_currency === 'function') return format_currency(v || 0, currency);
			return String(frappe.format(v || 0, { fieldtype: 'Currency' })).replace(/<[^>]+>/g, '');
		} catch (e) { return (v || 0).toLocaleString(); }
	}

	function loadData(root) {
		log('loading data from server script: crm_dashboard_data');
		frappe.call({
			method: 'crm_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-crm-stats'), data.stats || {});
				renderLeadsChart(root.querySelector('#ce-crm-leads-chart'), data.leads_series || []);
				renderRows(root.querySelector('#ce-crm-hot-opps'),     data.hot_opportunities || [], hotOppRow,     __('No open opportunities'));
				renderRows(root.querySelector('#ce-crm-recent-leads'), data.recent_leads || [],     recentLeadRow, __('No leads yet'));
				renderRows(root.querySelector('#ce-crm-open-opps'),    data.open_opportunities || [], openOppRow,  __('No open opportunities'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-crm-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "crm_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('New leads (this month)'), value: (s.new_leads_month || 0),  delta: s.leads_delta_pct, icon: '🎯' },
			{ label: __('Open opportunities'),     value: (s.open_opp_count || 0),   sub: fmtMoney(s.open_opp_value),  icon: '💼' },
			{ label: __('Won this month'),         value: (s.won_count || 0),        sub: fmtMoney(s.won_value),       icon: '🏆' },
			{ label: __('Active campaigns'),       value: (s.active_campaigns || 0), icon: '📣' },
		];
		host.innerHTML = cards.map(c => `
			<div class="ds-col-3 ce-card ce-card-brand">
				<div class="ce-card-top">
					<div class="ce-card-icon">${c.icon}</div>
					${typeof c.delta === 'number' ? `<div class="ce-delta ${c.delta >= 0 ? 'up' : 'down'}">${c.delta >= 0 ? '▲' : '▼'} ${Math.abs(c.delta).toFixed(1)}%</div>` : ''}
				</div>
				<div class="ce-card-value">${esc(String(c.value))}</div>
				<div class="ce-card-label">${esc(c.label)}</div>
				${c.sub ? `<div class="ce-card-sub">${esc(String(c.sub))}</div>` : ''}
			</div>
		`).join('');
	}

	function renderLeadsChart(el, series) {
		if (!el) return;
		el.innerHTML = '';
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No lead data'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'line',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				lineOptions: { regionFill: 1 },
				axisOptions: { xAxisMode: 'tick' },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Leads'), values: series.map(p => p.value || 0) }] },
			});
		} catch (e) {
			log('chart render failed', e);
			el.innerHTML = `<div class="ce-empty">${esc(__('Chart library not available'))}</div>`;
		}
	}

	function renderRows(host, items, rowFn, emptyMsg) {
		if (!host) return;
		if (!items.length) { host.innerHTML = `<div class="ce-empty">${esc(emptyMsg)}</div>`; return; }
		host.innerHTML = items.map(rowFn).join('');
	}

	function hotOppRow(o) {
		return `
			<a class="ce-row" href="/app/opportunity/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.customer_name || o.party_name || o.name)}</div>
					<div class="ce-row-sub">${esc(o.sales_stage || o.status || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(o.opportunity_amount)}</div>
				</div>
			</a>`;
	}

	function recentLeadRow(l) {
		return `
			<a class="ce-row" href="/app/lead/${encodeURIComponent(l.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(l.lead_name || l.name)}</div>
					<div class="ce-row-sub">${esc(l.company_name || l.email_id || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-row-sub">${esc(l.status || '')}</div>
				</div>
			</a>`;
	}

	function openOppRow(o) {
		return `
			<a class="ce-row" href="/app/opportunity/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.name)}</div>
					<div class="ce-row-sub">${esc(o.customer_name || o.party_name || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(o.opportunity_amount)}</div>
					<div class="ce-row-sub">${esc(o.status || '')}</div>
				</div>
			</a>`;
	}

	function applySidebarBranding() {
		if (!isCrmPath()) return;
		const header = document.querySelector('.body-sidebar .sidebar-header');
		if (!header || header.dataset.ceBranded === '1') return;
		const iconWrap = header.querySelector('.icon-container');
		if (iconWrap) {
			iconWrap.style.backgroundColor = '#DB4EE0';
			iconWrap.style.padding = '4px';
			iconWrap.innerHTML = '<img src="/assets/crm/images/logo.svg" alt="CRM" style="width:100%;height:100%;display:block;object-fit:contain;" />';
		}
		const subtitle = header.querySelector('.header-subtitle');
		if (subtitle) subtitle.textContent = 'Frappe CRM';
		header.dataset.ceBranded = '1';
	}

	function tick() {
		const want = isCrmPath();
		log('tick: isCrmPath =', want, 'mounted =', mounted);
		if (want && !mounted) {
			if (!mount()) { /* retry */ }
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			ensureBodyFlag(true);
		}
		applySidebarBranding();
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isCrmPath() && !document.querySelector('.ce-crm-root')) {
				log('observer: workspace DOM changed, attempting mount');
				mount();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === 'function') {
			frappe.router.on('change', () => {
				log('router change fired; route =', JSON.stringify(frappe.get_route()));
				const want = isCrmPath();
				if (!want) { unmount(); }
				else { mounted = false; tick(); }
			});
			log('router bound');
			return true;
		}
		return false;
	}

	function init() {
		log('init starting; readyState:', document.readyState);
		let n = 0;
		const iv = setInterval(() => {
			n++;
			if (bindRouter() || n > 80) {
				clearInterval(iv);
				if (n > 80) log('frappe.router never became available');
				startObserver();
				tick();
			}
		}, 100);

		window.addEventListener('load', () => setTimeout(tick, 200));
		let attempts = 0;
		const retry = setInterval(() => {
			attempts++;
			if (attempts > 50) { clearInterval(retry); return; }
			if (mounted) { clearInterval(retry); return; }
			if (isCrmPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
