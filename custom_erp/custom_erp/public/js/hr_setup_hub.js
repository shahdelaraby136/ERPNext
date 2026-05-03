/* Custom HR Setup Workspace Redesign — same brand theme as the other hubs.
   Hijacks /app/hr-setup and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_setup_dashboard_data
*/

(function () {
	const TAG = '[ce-hrsetup]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isHrSetupPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'hr-setup' || seg === 'hr setup') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/hr-setup' || p.startsWith('/app/hr-setup/') || p.startsWith('/app/hr-setup?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/hr-setup')) return true;
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
		document.body.classList.toggle('ce-hrsetup-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-hrsetup-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-hrsetup-root ce-theme-brand';
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
		document.querySelectorAll('.ce-hrsetup-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-hrsetup">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('HR Setup'))}</div>
							<h1 class="ce-hero-title">${esc(__('HR Setup Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-employee">👥 ${esc(__('Employee'))}</button>
							<button class="btn ce-hero-btn" data-action="new-department">🏢 ${esc(__('Department'))}</button>
							<button class="btn ce-hero-btn" data-action="new-designation">🎓 ${esc(__('Designation'))}</button>
							<button class="btn ce-hero-btn" data-action="new-employment-type">🏷️ ${esc(__('Employment Type'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('HR Setup pulse'))}</div>
					<div class="ds-grid" id="ce-hrsetup-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-hrsetup-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('New joiners — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/employee">${esc(__('All employees'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-hrsetup-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top departments'))}</div>
								<a class="ce-panel-link" href="/app/department">${esc(__('All departments'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-hrsetup-departments">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent employees'))}</div>
								<a class="ce-panel-link" href="/app/employee?status=Active">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-hrsetup-recent">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top designations'))}</div>
								<a class="ce-panel-link" href="/app/designation">${esc(__('All designations'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-hrsetup-designations">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-hrsetup-quick'));
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
			'new-employee':        newDoc('Employee'),
			'new-department':      newDoc('Department'),
			'new-designation':     newDoc('Designation'),
			'new-employment-type': newDoc('Employment Type'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Employee'),     icon: '👥', href: '/app/employee/new' },
			{ label: __('New Department'),   icon: '🏢', href: '/app/department/new' },
			{ label: __('New Designation'),  icon: '🎓', href: '/app/designation/new' },
			{ label: __('New Branch'),       icon: '🏬', href: '/app/branch/new' },
			{ label: __('Employees'),        icon: '📂', href: '/app/employee' },
			{ label: __('Departments'),      icon: '🗂️', href: '/app/department' },
			{ label: __('Holiday Lists'),    icon: '📆', href: '/app/holiday-list' },
			{ label: __('Employee Grades'),  icon: '📊', href: '/app/employee-grade' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function loadData(root) {
		log('loading data from server script: hr_setup_dashboard_data');
		frappe.call({
			method: 'hr_setup_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-hrsetup-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-hrsetup-chart'), data.joiners_series || []);
				renderRows(root.querySelector('#ce-hrsetup-departments'),  data.top_departments || [],  deptRow,        __('No departments yet'));
				renderRows(root.querySelector('#ce-hrsetup-recent'),       data.recent_employees || [], employeeRow,    __('No employees yet'));
				renderRows(root.querySelector('#ce-hrsetup-designations'), data.top_designations || [], designationRow, __('No designations yet'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-hrsetup-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_setup_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Active employees'),       value: (s.active_employees || 0),                                      icon: '👥' },
			{ label: __('New joiners (month)'),    value: (s.joiners_month || 0), delta: s.joiners_delta_pct,              icon: '🆕' },
			{ label: __('Departments'),            value: (s.departments || 0),                                            icon: '🏢' },
			{ label: __('Designations'),           value: (s.designations || 0),                                           icon: '🎓' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No joiner history'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('New joiners'), values: series.map(p => p.value || 0) }] },
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
			<a class="ce-row" href="/app/employee?department=${encodeURIComponent(d.department || '')}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(d.department || __('No department'))}</div>
					<div class="ce-row-sub">${esc(d.parent_department || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(String(d.employee_count || 0))}</div>
					<div class="ce-row-sub">${esc(__('employees'))}</div>
				</div>
			</a>`;
	}

	function employeeRow(e) {
		return `
			<a class="ce-row" href="/app/employee/${encodeURIComponent(e.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(e.employee_name || e.name)}</div>
					<div class="ce-row-sub">${esc(e.designation || e.department || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(e.date_of_joining || '')}</div>
					<div class="ce-row-sub">${esc(e.status || '')}</div>
				</div>
			</a>`;
	}

	function designationRow(d) {
		return `
			<a class="ce-row" href="/app/employee?designation=${encodeURIComponent(d.designation || '')}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(d.designation || __('No designation'))}</div>
					<div class="ce-row-sub">${esc(__('role'))}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(String(d.employee_count || 0))}</div>
					<div class="ce-row-sub">${esc(__('employees'))}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isHrSetupPath();
		log('tick: isHrSetupPath =', want, 'mounted =', mounted);
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
			if (isHrSetupPath() && !document.querySelector('.ce-hrsetup-root')) {
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
				const want = isHrSetupPath();
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
			if (isHrSetupPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
