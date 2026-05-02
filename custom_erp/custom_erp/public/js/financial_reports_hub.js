/* Custom Financial Reports Workspace Redesign — same brand theme.
   Hijacks /app/financial-reports — pure reports hub.
   Hero buttons OPEN reports (no new-doc); quick actions navigate.
   Data comes from Server Script: financial_reports_dashboard_data
*/

(function () {
	const TAG = '[ce-fin]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
		expense: '#DC2626',
	};

	function isFinPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'financial-reports' || seg === 'financial reports') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/financial-reports' || p.startsWith('/app/financial-reports/') || p.startsWith('/app/financial-reports?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/financial-reports')) return true;
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
		document.body.classList.toggle('ce-fin-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-fin-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-fin-root ce-theme-brand';
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
		document.querySelectorAll('.ce-fin-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();
		const fullName = (window.frappe && frappe.user && frappe.user.full_name && frappe.user.full_name())
			|| (window.frappe && frappe.session && frappe.session.user) || '';

		root.innerHTML = `
			<div class="ce-hero ce-hero-fin">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Financial Reports'))}</div>
							<h1 class="ce-hero-title">${esc(__('Financial Reports Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<a class="btn ce-hero-btn" href="/app/query-report/Balance Sheet">📊 ${esc(__('Balance Sheet'))}</a>
							<a class="btn ce-hero-btn" href="/app/query-report/Profit and Loss Statement">📈 ${esc(__('P&L Statement'))}</a>
							<a class="btn ce-hero-btn" href="/app/query-report/Cash Flow">💸 ${esc(__('Cash Flow'))}</a>
							<a class="btn ce-hero-btn" href="/app/query-report/General Ledger">📒 ${esc(__('General Ledger'))}</a>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Financial pulse (rolling)'))}</div>
					<div class="ds-grid" id="ce-fin-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick reports'))}</div>
					<div class="ds-grid" id="ce-fin-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Revenue vs Expenses — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/query-report/Profit and Loss Statement">${esc(__('Open P&L'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-fin-trend-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Cash & bank accounts'))}</div>
								<a class="ce-panel-link" href="/app/account?account_type=%5B%22in%22%2C%5B%22Cash%22%2C%22Bank%22%5D%5D">${esc(__('All accounts'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-fin-cash-accounts">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Outstanding receivables'))}</div>
								<a class="ce-panel-link" href="/app/query-report/Accounts Receivable">${esc(__('AR Report'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-fin-receivables">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Outstanding payables'))}</div>
								<a class="ce-panel-link" href="/app/query-report/Accounts Payable">${esc(__('AP Report'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-fin-payables">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		renderQuickActions(root.querySelector('#ce-fin-quick'));
		loadData(root);
	}

	function esc(s) {
		try { return frappe.utils.escape_html(s == null ? '' : String(s)); }
		catch (e) {
			return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
		}
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('Trial Balance'),         icon: '⚖️', href: '/app/query-report/Trial Balance' },
			{ label: __('Accounts Receivable'),   icon: '💰', href: '/app/query-report/Accounts Receivable' },
			{ label: __('Accounts Payable'),      icon: '💳', href: '/app/query-report/Accounts Payable' },
			{ label: __('Customer Ledger'),       icon: '👤', href: '/app/query-report/Customer Ledger Summary' },
			{ label: __('Supplier Ledger'),       icon: '🏭', href: '/app/query-report/Supplier Ledger Summary' },
			{ label: __('Sales Register'),        icon: '🧾', href: '/app/query-report/Sales Register' },
			{ label: __('Purchase Register'),     icon: '📋', href: '/app/query-report/Purchase Register' },
			{ label: __('Tax Detail'),            icon: '🧮', href: '/app/query-report/Tax Detail' },
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
		log('loading data from server script: financial_reports_dashboard_data');
		frappe.call({
			method: 'financial_reports_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-fin-stats'), data.stats || {});
				renderTrendChart(root.querySelector('#ce-fin-trend-chart'),
					data.labels || [], data.revenue_series || [], data.expense_series || []);
				renderRows(root.querySelector('#ce-fin-cash-accounts'), data.cash_accounts || [],          accountRow,    __('No cash/bank accounts'));
				renderRows(root.querySelector('#ce-fin-receivables'),   data.outstanding_receivables || [], receivableRow, __('No outstanding receivables'));
				renderRows(root.querySelector('#ce-fin-payables'),      data.outstanding_payables || [],    payableRow,    __('No outstanding payables'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-fin-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "financial_reports_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const net = Number(s.net_month || 0);
		const cards = [
			{ label: __('Revenue (this month)'),  value: fmtMoney(s.revenue_month), delta: s.revenue_delta_pct, icon: '💰' },
			{ label: __('Expenses (this month)'), value: fmtMoney(s.expense_month), icon: '💳' },
			{ label: __('Net (this month)'),      value: fmtMoney(net), sub: net >= 0 ? __('profit') : __('loss'), icon: net >= 0 ? '📈' : '📉' },
			{ label: __('Cash + Bank balance'),   value: fmtMoney(s.cash_bank_balance), icon: '🏦' },
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

	function renderTrendChart(el, labels, revenue, expense) {
		if (!el) return;
		el.innerHTML = '';
		if (!labels.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No financial data yet'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary, BRAND_PALETTE.expense],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: {
					labels: labels,
					datasets: [
						{ name: __('Revenue'),  values: revenue },
						{ name: __('Expenses'), values: expense },
					],
				},
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

	function accountRow(a) {
		return `
			<a class="ce-row" href="/app/account/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.account_name || a.name)}</div>
					<div class="ce-row-sub">${esc(a.account_type || '')} · ${esc(a.company || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(a.balance)}</div>
				</div>
			</a>`;
	}

	function receivableRow(r) {
		return `
			<a class="ce-row" href="/app/sales-invoice/${encodeURIComponent(r.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(r.name)}</div>
					<div class="ce-row-sub">${esc(r.customer_name || r.customer || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(r.outstanding_amount)}</div>
					<div class="ce-row-sub">${esc(r.due_date || r.status || '')}</div>
				</div>
			</a>`;
	}

	function payableRow(p) {
		return `
			<a class="ce-row" href="/app/purchase-invoice/${encodeURIComponent(p.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(p.name)}</div>
					<div class="ce-row-sub">${esc(p.supplier_name || p.supplier || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(p.outstanding_amount)}</div>
					<div class="ce-row-sub">${esc(p.due_date || p.status || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isFinPath();
		log('tick: isFinPath =', want, 'mounted =', mounted);
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
			if (isFinPath() && !document.querySelector('.ce-fin-root')) {
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
				const want = isFinPath();
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
			if (isFinPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
