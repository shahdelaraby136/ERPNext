/* Custom Tax & Benefits Workspace Redesign — same brand theme as the
   other hubs. Hijacks /app/tax-&-benefits and renders Hero + KPIs +
   chart + lists. Data comes from Server Script: hr_tax_dashboard_data
*/

(function () {
	const TAG = '[ce-tax]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isTaxPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			// Frappe slugs "Tax & Benefits" → "tax-&-benefits"; browsers may normalize.
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (
					seg === 'tax-&-benefits' ||
					seg === 'tax-%26-benefits' ||
					seg === 'tax-and-benefits' ||
					seg === 'tax-benefits'
				) return true;
			}
			const full = (
				(window.location.pathname || '') +
				(window.location.search || '') +
				(window.location.hash || '')
			).toLowerCase();
			if (
				full.includes('tax-&-benefits') ||
				full.includes('tax-%26-benefits') ||
				full.includes('tax-and-benefits') ||
				full.includes('tax-benefits')
			) return true;
			const h1 = document.querySelector('.layout-main-section h3, .layout-main-section .workspace-title');
			if (h1 && (h1.textContent || '').trim() === 'Tax & Benefits') return true;
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
		document.body.classList.toggle('ce-tax-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-tax-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-tax-root ce-theme-brand';
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
		document.querySelectorAll('.ce-tax-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-tax">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Tax & Benefits'))}</div>
							<h1 class="ce-hero-title">${esc(__('Tax & Benefits Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-declaration">🧾 ${esc(__('Tax Declaration'))}</button>
							<button class="btn ce-hero-btn" data-action="new-proof">📄 ${esc(__('Proof Submission'))}</button>
							<button class="btn ce-hero-btn" data-action="new-benefit-app">🎁 ${esc(__('Benefit App.'))}</button>
							<button class="btn ce-hero-btn" data-action="new-benefit-claim">💵 ${esc(__('Benefit Claim'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Tax & Benefits pulse'))}</div>
					<div class="ds-grid" id="ce-tax-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-tax-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Benefit claims — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/employee-benefit-claim">${esc(__('All claims'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tax-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Active tax slabs'))}</div>
								<a class="ce-panel-link" href="/app/income-tax-slab">${esc(__('All slabs'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tax-slabs">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Pending tax declarations'))}</div>
								<a class="ce-panel-link" href="/app/employee-tax-exemption-declaration?docstatus=0">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tax-pending">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent benefit claims'))}</div>
								<a class="ce-panel-link" href="/app/employee-benefit-claim">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tax-claims">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-tax-quick'));
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
			'new-declaration':  newDoc('Employee Tax Exemption Declaration'),
			'new-proof':        newDoc('Employee Tax Exemption Proof Submission'),
			'new-benefit-app':  newDoc('Employee Benefit Application'),
			'new-benefit-claim': newDoc('Employee Benefit Claim'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Tax Declaration'),    icon: '🧾', href: '/app/employee-tax-exemption-declaration/new' },
			{ label: __('New Proof Submission'),   icon: '📄', href: '/app/employee-tax-exemption-proof-submission/new' },
			{ label: __('New Benefit Application'), icon: '🎁', href: '/app/employee-benefit-application/new' },
			{ label: __('New Benefit Claim'),      icon: '💵', href: '/app/employee-benefit-claim/new' },
			{ label: __('Tax Slabs'),              icon: '📊', href: '/app/income-tax-slab' },
			{ label: __('Tax Declarations'),       icon: '🗂️', href: '/app/employee-tax-exemption-declaration' },
			{ label: __('Benefit Applications'),   icon: '📂', href: '/app/employee-benefit-application' },
			{ label: __('Benefit Claims'),         icon: '🏷️', href: '/app/employee-benefit-claim' },
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
		log('loading data from server script: hr_tax_dashboard_data');
		frappe.call({
			method: 'hr_tax_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-tax-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-tax-chart'), data.claims_series || []);
				renderRows(root.querySelector('#ce-tax-slabs'),   data.active_slabs || [],         slabRow,        __('No active tax slabs'));
				renderRows(root.querySelector('#ce-tax-pending'), data.pending_declarations || [], declarationRow, __('No pending declarations'));
				renderRows(root.querySelector('#ce-tax-claims'),  data.recent_claims || [],        claimRow,       __('No benefit claims yet'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-tax-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_tax_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Active declarations'),    value: (s.active_declarations || 0),                                  icon: '🧾' },
			{ label: __('Total exemption'),        value: fmtMoney(s.total_exemption),                                   icon: '💰' },
			{ label: __('Benefit apps (month)'),   value: (s.benefit_apps_month || 0),                                   icon: '🎁' },
			{ label: __('Benefit claims (month)'), value: fmtMoney(s.claims_month), delta: s.claims_delta_pct,           icon: '💵' },
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

	function renderChart(el, series) {
		if (!el) return;
		el.innerHTML = '';
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No claims recorded'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Claims'), values: series.map(p => p.value || 0) }] },
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

	function slabRow(s) {
		return `
			<a class="ce-row" href="/app/income-tax-slab/${encodeURIComponent(s.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(s.name)}</div>
					<div class="ce-row-sub">${esc(s.effective_from || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(s.standard_tax_exemption_amount)}</div>
					<div class="ce-row-sub">${esc(__('exemption'))}</div>
				</div>
			</a>`;
	}

	function declarationRow(d) {
		return `
			<a class="ce-row" href="/app/employee-tax-exemption-declaration/${encodeURIComponent(d.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(d.employee_name || d.employee || d.name)}</div>
					<div class="ce-row-sub">${esc(d.payroll_period || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(d.total_exemption_amount)}</div>
					<div class="ce-row-sub">${esc(__('exemption'))}</div>
				</div>
			</a>`;
	}

	function claimRow(c) {
		return `
			<a class="ce-row" href="/app/employee-benefit-claim/${encodeURIComponent(c.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(c.employee_name || c.employee || c.name)}</div>
					<div class="ce-row-sub">${esc(c.payroll_date || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(c.claimed_amount)}</div>
					<div class="ce-row-sub">${esc(__('claimed'))}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isTaxPath();
		log('tick: isTaxPath =', want, 'mounted =', mounted);
		if (want && !mounted) {
			if (!mount()) { /* retry */ }
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			ensureBodyFlag(true);
		}
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isTaxPath() && !document.querySelector('.ce-tax-root')) {
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
				const want = isTaxPath();
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
			if (isTaxPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
