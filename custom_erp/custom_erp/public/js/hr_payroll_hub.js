/* Custom Payroll Workspace Redesign — same brand theme as Projects/Stock/etc.
   Hijacks /app/payroll and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_payroll_dashboard_data
*/

(function () {
	const TAG = '[ce-payroll]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isPayrollPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'payroll') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/payroll' || p.startsWith('/app/payroll/') || p.startsWith('/app/payroll?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/payroll')) return true;
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
		document.body.classList.toggle('ce-payroll-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-payroll-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-payroll-root ce-theme-brand';
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
		document.querySelectorAll('.ce-payroll-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-payroll">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Payroll'))}</div>
							<h1 class="ce-hero-title">${esc(__('Payroll Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-slip">💰 ${esc(__('Salary Slip'))}</button>
							<button class="btn ce-hero-btn" data-action="new-structure">📋 ${esc(__('Salary Structure'))}</button>
							<button class="btn ce-hero-btn" data-action="new-entry">🎯 ${esc(__('Payroll Entry'))}</button>
							<button class="btn ce-hero-btn" data-action="new-additional">➕ ${esc(__('Additional Salary'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Payroll pulse'))}</div>
					<div class="ds-grid" id="ce-payroll-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-payroll-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Net pay — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/salary-slip">${esc(__('Salary slips'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-payroll-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top employees (this month)'))}</div>
								<a class="ce-panel-link" href="/app/salary-slip">${esc(__('All slips'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-payroll-top">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Pending salary slips'))}</div>
								<a class="ce-panel-link" href="/app/salary-slip?docstatus=0">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-payroll-pending">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent payroll entries'))}</div>
								<a class="ce-panel-link" href="/app/payroll-entry">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-payroll-entries">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-payroll-quick'));
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
			'new-slip':       newDoc('Salary Slip'),
			'new-structure':  newDoc('Salary Structure'),
			'new-entry':      newDoc('Payroll Entry'),
			'new-additional': newDoc('Additional Salary'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Salary Slip'),       icon: '💰', href: '/app/salary-slip/new' },
			{ label: __('New Salary Structure'),  icon: '📋', href: '/app/salary-structure/new' },
			{ label: __('New Payroll Entry'),     icon: '🎯', href: '/app/payroll-entry/new' },
			{ label: __('Additional Salary'),     icon: '➕', href: '/app/additional-salary/new' },
			{ label: __('Salary Slips'),          icon: '📂', href: '/app/salary-slip' },
			{ label: __('Payroll Entries'),       icon: '🗂️', href: '/app/payroll-entry' },
			{ label: __('Salary Register'),       icon: '📈', href: '/app/query-report/Salary Register' },
			{ label: __('Salary Structures'),     icon: '📊', href: '/app/salary-structure' },
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
		log('loading data from server script: hr_payroll_dashboard_data');
		frappe.call({
			method: 'hr_payroll_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-payroll-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-payroll-chart'), data.netpay_series || []);
				renderRows(root.querySelector('#ce-payroll-top'),     data.top_employees || [],     employeeRow,    __('No salary slips this month'));
				renderRows(root.querySelector('#ce-payroll-pending'), data.pending_slips || [],     pendingSlipRow, __('No pending salary slips'));
				renderRows(root.querySelector('#ce-payroll-entries'), data.recent_entries || [],    entryRow,       __('No payroll entries yet'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-payroll-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_payroll_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Total payroll (this month)'), value: fmtMoney(s.payroll_month), delta: s.payroll_delta_pct, icon: '💰' },
			{ label: __('Employees paid'),             value: (s.employees_paid || 0),                                icon: '👥' },
			{ label: __('Pending slips'),              value: (s.pending_slips || 0), sub: (s.draft_slips || 0) + ' ' + __('draft'), icon: '⏳' },
			{ label: __('Avg net pay (this month)'),   value: fmtMoney(s.avg_net_pay),                                icon: '📊' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No payroll history yet'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Net pay'), values: series.map(p => p.value || 0) }] },
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

	function employeeRow(e) {
		return `
			<a class="ce-row" href="/app/employee/${encodeURIComponent(e.employee || '')}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(e.employee_name || e.employee || '')}</div>
					<div class="ce-row-sub">${esc(e.department || e.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(e.net_pay)}</div>
					<div class="ce-row-sub">${esc(e.slip_count || '')} ${esc(__('slips'))}</div>
				</div>
			</a>`;
	}

	function pendingSlipRow(p) {
		return `
			<a class="ce-row" href="/app/salary-slip/${encodeURIComponent(p.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(p.employee_name || p.name)}</div>
					<div class="ce-row-sub">${esc(p.department || p.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(p.net_pay)}</div>
					<div class="ce-row-sub">${esc(p.posting_date || '')}</div>
				</div>
			</a>`;
	}

	function entryRow(e) {
		return `
			<a class="ce-row" href="/app/payroll-entry/${encodeURIComponent(e.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(e.name)}</div>
					<div class="ce-row-sub">${esc(e.payroll_frequency || e.company || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(e.start_date || '')}</div>
					<div class="ce-row-sub">${esc(e.status || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isPayrollPath();
		log('tick: isPayrollPath =', want, 'mounted =', mounted);
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
			if (isPayrollPath() && !document.querySelector('.ce-payroll-root')) {
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
				const want = isPayrollPath();
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
			if (isPayrollPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
