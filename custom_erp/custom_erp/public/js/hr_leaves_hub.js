/* Custom Leaves Workspace Redesign — same brand theme as the other hubs.
   Hijacks /app/leaves and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_leaves_dashboard_data
*/

(function () {
	const TAG = '[ce-leaves]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isLeavesPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'leaves') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/leaves' || p.startsWith('/app/leaves/') || p.startsWith('/app/leaves?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/leaves')) return true;
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
		document.body.classList.toggle('ce-leaves-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-leaves-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-leaves-root ce-theme-brand';
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
		document.querySelectorAll('.ce-leaves-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-leaves">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Leaves'))}</div>
							<h1 class="ce-hero-title">${esc(__('Leaves Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-application">🌴 ${esc(__('Leave Application'))}</button>
							<button class="btn ce-hero-btn" data-action="new-allocation">📅 ${esc(__('Leave Allocation'))}</button>
							<button class="btn ce-hero-btn" data-action="new-holiday-list">🎉 ${esc(__('Holiday List'))}</button>
							<button class="btn ce-hero-btn" data-action="new-comp-request">🔄 ${esc(__('Comp. Request'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Leaves pulse'))}</div>
					<div class="ds-grid" id="ce-leaves-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-leaves-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Leaves taken — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/leave-application">${esc(__('All applications'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-leaves-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('On leave today'))}</div>
								<a class="ce-panel-link" href="/app/leave-application?status=Approved">${esc(__('Approved'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-leaves-today">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Pending approvals'))}</div>
								<a class="ce-panel-link" href="/app/leave-application?status=Open">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-leaves-pending">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent applications'))}</div>
								<a class="ce-panel-link" href="/app/leave-application">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-leaves-recent">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-leaves-quick'));
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
			'new-application':  newDoc('Leave Application'),
			'new-allocation':   newDoc('Leave Allocation'),
			'new-holiday-list': newDoc('Holiday List'),
			'new-comp-request': newDoc('Compensatory Leave Request'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Leave Application'), icon: '🌴', href: '/app/leave-application/new' },
			{ label: __('New Leave Allocation'),  icon: '📅', href: '/app/leave-allocation/new' },
			{ label: __('New Holiday List'),      icon: '🎉', href: '/app/holiday-list/new' },
			{ label: __('Comp. Leave Request'),   icon: '🔄', href: '/app/compensatory-leave-request/new' },
			{ label: __('Leave Applications'),    icon: '📂', href: '/app/leave-application' },
			{ label: __('Leave Allocations'),     icon: '🗂️', href: '/app/leave-allocation' },
			{ label: __('Leave Types'),           icon: '🏷️', href: '/app/leave-type' },
			{ label: __('Holiday Lists'),         icon: '📆', href: '/app/holiday-list' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function fmtDays(v) {
		const n = Number(v || 0);
		if (Math.abs(n - Math.round(n)) < 0.05) return Math.round(n) + ' ' + __('d');
		return n.toFixed(1) + ' ' + __('d');
	}

	function loadData(root) {
		log('loading data from server script: hr_leaves_dashboard_data');
		frappe.call({
			method: 'hr_leaves_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-leaves-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-leaves-chart'), data.leaves_series || []);
				renderRows(root.querySelector('#ce-leaves-today'),   data.on_leave_today || [], onLeaveRow,    __('No one on leave today'));
				renderRows(root.querySelector('#ce-leaves-pending'), data.pending_apps || [],   pendingAppRow, __('No pending approvals'));
				renderRows(root.querySelector('#ce-leaves-recent'),  data.recent_apps || [],    recentAppRow,  __('No leave applications yet'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-leaves-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_leaves_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Pending approvals'),       value: (s.pending_count || 0),                     icon: '⏳' },
			{ label: __('On leave today'),          value: (s.on_leave_today || 0),                    icon: '🌴' },
			{ label: __('Leaves (this month)'),     value: fmtDays(s.leave_days_month), delta: s.leave_delta_pct, icon: '📅' },
			{ label: __('Avg days / employee'),     value: fmtDays(s.avg_days_per_emp),                icon: '📊' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No leaves recorded'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Leave days'), values: series.map(p => p.value || 0) }] },
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

	function onLeaveRow(r) {
		return `
			<a class="ce-row" href="/app/leave-application/${encodeURIComponent(r.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(r.employee_name || r.employee || '')}</div>
					<div class="ce-row-sub">${esc(r.leave_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtDays(r.total_leave_days)}</div>
					<div class="ce-row-sub">${esc(r.to_date || '')}</div>
				</div>
			</a>`;
	}

	function pendingAppRow(r) {
		return `
			<a class="ce-row" href="/app/leave-application/${encodeURIComponent(r.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(r.employee_name || r.employee || r.name)}</div>
					<div class="ce-row-sub">${esc(r.leave_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtDays(r.total_leave_days)}</div>
					<div class="ce-row-sub">${esc(r.from_date || '')}</div>
				</div>
			</a>`;
	}

	function recentAppRow(r) {
		return `
			<a class="ce-row" href="/app/leave-application/${encodeURIComponent(r.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(r.employee_name || r.employee || r.name)}</div>
					<div class="ce-row-sub">${esc(r.leave_type || '')} · ${esc(r.status || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtDays(r.total_leave_days)}</div>
					<div class="ce-row-sub">${esc(r.from_date || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isLeavesPath();
		log('tick: isLeavesPath =', want, 'mounted =', mounted);
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
			if (isLeavesPath() && !document.querySelector('.ce-leaves-root')) {
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
				const want = isLeavesPath();
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
			if (isLeavesPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
