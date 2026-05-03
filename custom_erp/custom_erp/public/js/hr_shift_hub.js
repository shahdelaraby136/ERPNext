/* Custom Shift & Attendance Workspace Redesign — same brand theme as the
   other hubs. Hijacks /app/shift-&-attendance and renders Hero + KPIs +
   chart + lists. Data comes from Server Script: hr_shift_dashboard_data
*/

(function () {
	const TAG = '[ce-shift]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isShiftPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			// Frappe's slug() lowercases + replaces spaces with `-`; "Shift & Attendance"
			// becomes "shift-&-attendance". Browsers may also keep "shift-%26-attendance"
			// (encoded) or normalize to "shift-attendance" / "shift-and-attendance".
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (
					seg === 'shift-&-attendance' ||
					seg === 'shift-%26-attendance' ||
					seg === 'shift-and-attendance' ||
					seg === 'shift-attendance'
				) return true;
			}
			// Fallback: scan the full URL (pathname + search + hash) — `&` becomes part
			// of the query string in some browsers, so the segment can't be relied on.
			const full = (
				(window.location.pathname || '') +
				(window.location.search || '') +
				(window.location.hash || '')
			).toLowerCase();
			if (
				full.includes('shift-&-attendance') ||
				full.includes('shift-%26-attendance') ||
				full.includes('shift-and-attendance') ||
				full.includes('shift-attendance')
			) return true;
			// Last resort: if Frappe rendered the workspace heading already, match by title.
			// Used when both the path and route are ambiguous.
			const h1 = document.querySelector('.layout-main-section h3, .layout-main-section .workspace-title');
			if (h1 && (h1.textContent || '').trim() === 'Shift & Attendance') return true;
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
		document.body.classList.toggle('ce-shift-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-shift-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-shift-root ce-theme-brand';
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
		document.querySelectorAll('.ce-shift-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-shift">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Shift & Attendance'))}</div>
							<h1 class="ce-hero-title">${esc(__('Attendance Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-attendance">✅ ${esc(__('Attendance'))}</button>
							<button class="btn ce-hero-btn" data-action="new-checkin">⏰ ${esc(__('Checkin'))}</button>
							<button class="btn ce-hero-btn" data-action="new-shift-assign">🔄 ${esc(__('Shift Assign'))}</button>
							<button class="btn ce-hero-btn" data-action="new-att-request">📋 ${esc(__('Att. Request'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Attendance pulse'))}</div>
					<div class="ds-grid" id="ce-shift-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-shift-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Attendance — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/attendance">${esc(__('All records'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-shift-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Checked in today'))}</div>
								<a class="ce-panel-link" href="/app/employee-checkin">${esc(__('All checkins'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-shift-checkins">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Pending attendance requests'))}</div>
								<a class="ce-panel-link" href="/app/attendance-request?docstatus=0">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-shift-requests">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent shift assignments'))}</div>
								<a class="ce-panel-link" href="/app/shift-assignment">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-shift-assignments">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-shift-quick'));
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
			'new-attendance':   newDoc('Attendance'),
			'new-checkin':      newDoc('Employee Checkin'),
			'new-shift-assign': newDoc('Shift Assignment'),
			'new-att-request':  newDoc('Attendance Request'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Attendance'),         icon: '✅', href: '/app/attendance/new' },
			{ label: __('New Checkin'),            icon: '⏰', href: '/app/employee-checkin/new' },
			{ label: __('New Shift Assignment'),   icon: '🔄', href: '/app/shift-assignment/new' },
			{ label: __('New Attendance Request'), icon: '📋', href: '/app/attendance-request/new' },
			{ label: __('Attendance'),             icon: '📂', href: '/app/attendance' },
			{ label: __('Employee Checkins'),      icon: '🗂️', href: '/app/employee-checkin' },
			{ label: __('Shift Types'),            icon: '🏷️', href: '/app/shift-type' },
			{ label: __('Shift Assignments'),      icon: '📊', href: '/app/shift-assignment' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function fmtHours(v) {
		const n = Number(v || 0);
		if (n >= 1000) return (n / 1000).toFixed(1) + 'k h';
		return n.toFixed(1) + ' h';
	}

	function loadData(root) {
		log('loading data from server script: hr_shift_dashboard_data');
		frappe.call({
			method: 'hr_shift_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-shift-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-shift-chart'), data.attendance_series || []);
				renderRows(root.querySelector('#ce-shift-checkins'),    data.checked_in_today || [],   checkinRow,    __('No checkins yet today'));
				renderRows(root.querySelector('#ce-shift-requests'),    data.pending_requests || [],   requestRow,    __('No pending requests'));
				renderRows(root.querySelector('#ce-shift-assignments'), data.recent_assignments || [], assignmentRow, __('No recent shift assignments'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-shift-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_shift_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Present today'),          value: (s.present_today || 0),                                       icon: '✅' },
			{ label: __('Late today'),             value: (s.late_today || 0),                                          icon: '⏰' },
			{ label: __('Hours (this month)'),     value: fmtHours(s.hours_month), delta: s.hours_delta_pct,             icon: '📊' },
			{ label: __('Pending requests'),       value: (s.pending_requests || 0),                                    icon: '📋' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No attendance recorded'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Present days'), values: series.map(p => p.value || 0) }] },
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

	function checkinRow(c) {
		return `
			<a class="ce-row" href="/app/employee-checkin/${encodeURIComponent(c.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(c.employee_name || c.employee || c.name)}</div>
					<div class="ce-row-sub">${esc(c.shift || c.device_id || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(c.log_type || '')}</div>
					<div class="ce-row-sub">${esc(c.time || '')}</div>
				</div>
			</a>`;
	}

	function requestRow(r) {
		return `
			<a class="ce-row" href="/app/attendance-request/${encodeURIComponent(r.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(r.employee_name || r.employee || r.name)}</div>
					<div class="ce-row-sub">${esc(r.reason || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(r.from_date || '')}</div>
					<div class="ce-row-sub">${esc(r.to_date || '')}</div>
				</div>
			</a>`;
	}

	function assignmentRow(a) {
		return `
			<a class="ce-row" href="/app/shift-assignment/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.employee_name || a.employee || a.name)}</div>
					<div class="ce-row-sub">${esc(a.shift_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(a.start_date || '')}</div>
					<div class="ce-row-sub">${esc(a.status || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isShiftPath();
		log('tick: isShiftPath =', want, 'mounted =', mounted);
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
			if (isShiftPath() && !document.querySelector('.ce-shift-root')) {
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
				const want = isShiftPath();
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
			if (isShiftPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
