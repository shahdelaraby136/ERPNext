/* Custom Expenses Workspace Redesign — same brand theme as the other hubs.
   Hijacks /app/expenses and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_expenses_dashboard_data
*/

(function () {
	const TAG = '[ce-exp]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isExpPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'expenses') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/expenses' || p.startsWith('/app/expenses/') || p.startsWith('/app/expenses?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/expenses')) return true;
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
		document.body.classList.toggle('ce-exp-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-exp-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-exp-root ce-theme-brand';
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
		document.querySelectorAll('.ce-exp-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-exp">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Expenses'))}</div>
							<h1 class="ce-hero-title">${esc(__('Expenses Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-claim">🧾 ${esc(__('Expense Claim'))}</button>
							<button class="btn ce-hero-btn" data-action="new-travel">✈️ ${esc(__('Travel Request'))}</button>
							<button class="btn ce-hero-btn" data-action="new-advance">💵 ${esc(__('Advance'))}</button>
							<button class="btn ce-hero-btn" data-action="new-type">🏷️ ${esc(__('Expense Type'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Expenses pulse'))}</div>
					<div class="ds-grid" id="ce-exp-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-exp-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Claims sanctioned — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/expense-claim">${esc(__('All claims'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-exp-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top departments'))}</div>
								<a class="ce-panel-link" href="/app/expense-claim">${esc(__('Spend report'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-exp-departments">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Pending claims'))}</div>
								<a class="ce-panel-link" href="/app/expense-claim?approval_status=Draft">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-exp-pending">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent advances'))}</div>
								<a class="ce-panel-link" href="/app/employee-advance">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-exp-advances">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-exp-quick'));
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
			'new-claim':   newDoc('Expense Claim'),
			'new-travel':  newDoc('Travel Request'),
			'new-advance': newDoc('Employee Advance'),
			'new-type':    newDoc('Expense Claim Type'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Expense Claim'),  icon: '🧾', href: '/app/expense-claim/new' },
			{ label: __('New Travel Request'), icon: '✈️', href: '/app/travel-request/new' },
			{ label: __('New Advance'),        icon: '💵', href: '/app/employee-advance/new' },
			{ label: __('New Expense Type'),   icon: '🏷️', href: '/app/expense-claim-type/new' },
			{ label: __('Expense Claims'),     icon: '📂', href: '/app/expense-claim' },
			{ label: __('Travel Requests'),    icon: '🗂️', href: '/app/travel-request' },
			{ label: __('Employee Advances'),  icon: '📊', href: '/app/employee-advance' },
			{ label: __('Expense Types'),      icon: '🪪', href: '/app/expense-claim-type' },
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
		log('loading data from server script: hr_expenses_dashboard_data');
		frappe.call({
			method: 'hr_expenses_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-exp-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-exp-chart'), data.claims_series || []);
				renderRows(root.querySelector('#ce-exp-departments'), data.top_departments || [], deptRow,    __('No claim history'));
				renderRows(root.querySelector('#ce-exp-pending'),     data.pending_claims || [],   claimRow,   __('No pending claims'));
				renderRows(root.querySelector('#ce-exp-advances'),    data.recent_advances || [],  advanceRow, __('No advances yet'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-exp-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_expenses_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Pending claims'),         value: (s.pending_claims || 0),                                       icon: '🧾' },
			{ label: __('Claims (this month)'),    value: fmtMoney(s.claimed_month), delta: s.claims_delta_pct,           icon: '💰' },
			{ label: __('Approved (this month)'),  value: (s.approved_month || 0),                                       icon: '✅' },
			{ label: __('Outstanding advances'),   value: fmtMoney(s.outstanding_advances),                              icon: '💵' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No claim history'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Sanctioned'), values: series.map(p => p.value || 0) }] },
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

	function deptRow(d) {
		return `
			<a class="ce-row" href="/app/expense-claim?department=${encodeURIComponent(d.department || '')}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(d.department || __('No department'))}</div>
					<div class="ce-row-sub">${esc(String(d.claim_count || 0))} ${esc(__('claims'))}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(d.total_sanctioned)}</div>
					<div class="ce-row-sub">${esc(__('sanctioned'))}</div>
				</div>
			</a>`;
	}

	function claimRow(c) {
		return `
			<a class="ce-row" href="/app/expense-claim/${encodeURIComponent(c.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(c.employee_name || c.employee || c.name)}</div>
					<div class="ce-row-sub">${esc(c.department || c.approval_status || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(c.total_claimed_amount)}</div>
					<div class="ce-row-sub">${esc(c.posting_date || '')}</div>
				</div>
			</a>`;
	}

	function advanceRow(a) {
		return `
			<a class="ce-row" href="/app/employee-advance/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.employee_name || a.employee || a.name)}</div>
					<div class="ce-row-sub">${esc(a.status || a.department || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(a.advance_amount)}</div>
					<div class="ce-row-sub">${esc(a.posting_date || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isExpPath();
		log('tick: isExpPath =', want, 'mounted =', mounted);
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
			if (isExpPath() && !document.querySelector('.ce-exp-root')) {
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
				const want = isExpPath();
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
			if (isExpPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
