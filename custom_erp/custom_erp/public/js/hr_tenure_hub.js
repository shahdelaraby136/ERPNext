/* Custom Tenure Workspace Redesign — same brand theme as the other hubs.
   Hijacks /app/tenure and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_tenure_dashboard_data
*/

(function () {
	const TAG = '[ce-tenure]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isTenurePath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'tenure') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/tenure' || p.startsWith('/app/tenure/') || p.startsWith('/app/tenure?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/tenure')) return true;
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
		document.body.classList.toggle('ce-tenure-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-tenure-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-tenure-root ce-theme-brand';
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
		document.querySelectorAll('.ce-tenure-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-tenure">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Tenure'))}</div>
							<h1 class="ce-hero-title">${esc(__('Tenure Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-onboarding">🚀 ${esc(__('Onboarding'))}</button>
							<button class="btn ce-hero-btn" data-action="new-separation">👋 ${esc(__('Separation'))}</button>
							<button class="btn ce-hero-btn" data-action="new-promotion">⬆️ ${esc(__('Promotion'))}</button>
							<button class="btn ce-hero-btn" data-action="new-transfer">🔁 ${esc(__('Transfer'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Tenure pulse'))}</div>
					<div class="ds-grid" id="ce-tenure-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-tenure-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Headcount events — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/employee">${esc(__('Employees'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tenure-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open grievances'))}</div>
								<a class="ce-panel-link" href="/app/employee-grievance?status=Open">${esc(__('All grievances'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tenure-grievances">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Active onboardings'))}</div>
								<a class="ce-panel-link" href="/app/employee-onboarding?docstatus=0">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tenure-onboardings">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Active separations'))}</div>
								<a class="ce-panel-link" href="/app/employee-separation?docstatus=0">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-tenure-separations">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-tenure-quick'));
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
			'new-onboarding': newDoc('Employee Onboarding'),
			'new-separation': newDoc('Employee Separation'),
			'new-promotion':  newDoc('Employee Promotion'),
			'new-transfer':   newDoc('Employee Transfer'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Onboarding'), icon: '🚀', href: '/app/employee-onboarding/new' },
			{ label: __('New Separation'), icon: '👋', href: '/app/employee-separation/new' },
			{ label: __('New Promotion'),  icon: '⬆️', href: '/app/employee-promotion/new' },
			{ label: __('New Transfer'),   icon: '🔁', href: '/app/employee-transfer/new' },
			{ label: __('Onboardings'),    icon: '📂', href: '/app/employee-onboarding' },
			{ label: __('Separations'),    icon: '🗂️', href: '/app/employee-separation' },
			{ label: __('Promotions'),     icon: '📊', href: '/app/employee-promotion' },
			{ label: __('Transfers'),      icon: '🏷️', href: '/app/employee-transfer' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function loadData(root) {
		log('loading data from server script: hr_tenure_dashboard_data');
		frappe.call({
			method: 'hr_tenure_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-tenure-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-tenure-chart'), data.events_series || []);
				renderRows(root.querySelector('#ce-tenure-grievances'),  data.open_grievances || [],   grievanceRow,  __('No open grievances'));
				renderRows(root.querySelector('#ce-tenure-onboardings'), data.active_onboardings || [], onboardingRow, __('No active onboardings'));
				renderRows(root.querySelector('#ce-tenure-separations'), data.active_separations || [], separationRow, __('No active separations'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-tenure-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_tenure_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Active onboardings'),  value: (s.active_onboardings || 0),                                  icon: '🚀' },
			{ label: __('Active separations'),  value: (s.active_separations || 0),                                  icon: '👋' },
			{ label: __('Promotions (month)'),  value: (s.promotions_month || 0), delta: s.promotions_delta_pct,     icon: '⬆️' },
			{ label: __('Transfers (month)'),   value: (s.transfers_month || 0),                                     icon: '🔁' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No tenure events yet'))}</div>`; return; }
		try {
			const labels = series.map(p => p.label);
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary, '#16A34A', '#DC2626'],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4, stacked: 0 },
				data: {
					labels: labels,
					datasets: [
						{ name: __('Onboardings'), values: series.map(p => p.onboardings || 0) },
						{ name: __('Separations'), values: series.map(p => p.separations || 0) },
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

	function grievanceRow(g) {
		return `
			<a class="ce-row" href="/app/employee-grievance/${encodeURIComponent(g.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(g.employee_name || g.name)}</div>
					<div class="ce-row-sub">${esc(g.grievance_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(g.status || '')}</div>
					<div class="ce-row-sub">${esc(g.date || '')}</div>
				</div>
			</a>`;
	}

	function onboardingRow(o) {
		return `
			<a class="ce-row" href="/app/employee-onboarding/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.employee_name || o.employee || o.name)}</div>
					<div class="ce-row-sub">${esc(o.department || o.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(o.boarding_status || '')}</div>
					<div class="ce-row-sub">${esc(o.date_of_joining || o.boarding_begins_on || '')}</div>
				</div>
			</a>`;
	}

	function separationRow(s) {
		return `
			<a class="ce-row" href="/app/employee-separation/${encodeURIComponent(s.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(s.employee_name || s.employee || s.name)}</div>
					<div class="ce-row-sub">${esc(s.department || s.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(s.boarding_status || '')}</div>
					<div class="ce-row-sub">${esc(s.resignation_letter_date || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isTenurePath();
		log('tick: isTenurePath =', want, 'mounted =', mounted);
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
			if (isTenurePath() && !document.querySelector('.ce-tenure-root')) {
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
				const want = isTenurePath();
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
			if (isTenurePath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
