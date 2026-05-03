/* Custom Performance Workspace Redesign — same brand theme as the other hubs.
   Hijacks /app/performance and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_performance_dashboard_data
*/

(function () {
	const TAG = '[ce-perf]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isPerfPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'performance') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/performance' || p.startsWith('/app/performance/') || p.startsWith('/app/performance?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/performance')) return true;
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
		document.body.classList.toggle('ce-perf-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-perf-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-perf-root ce-theme-brand';
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
		document.querySelectorAll('.ce-perf-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-perf">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Performance'))}</div>
							<h1 class="ce-hero-title">${esc(__('Performance Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-appraisal">📋 ${esc(__('Appraisal'))}</button>
							<button class="btn ce-hero-btn" data-action="new-goal">🎯 ${esc(__('Goal'))}</button>
							<button class="btn ce-hero-btn" data-action="new-cycle">📅 ${esc(__('Appraisal Cycle'))}</button>
							<button class="btn ce-hero-btn" data-action="new-feedback">💬 ${esc(__('Feedback'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Performance pulse'))}</div>
					<div class="ds-grid" id="ce-perf-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-perf-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Appraisals — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/appraisal">${esc(__('All appraisals'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-perf-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top performers'))}</div>
								<a class="ce-panel-link" href="/app/appraisal">${esc(__('All scores'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-perf-top">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Active appraisals'))}</div>
								<a class="ce-panel-link" href="/app/appraisal?docstatus=0">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-perf-active">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open goals'))}</div>
								<a class="ce-panel-link" href="/app/goal">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-perf-goals">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-perf-quick'));
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
			'new-appraisal': newDoc('Appraisal'),
			'new-goal':      newDoc('Goal'),
			'new-cycle':     newDoc('Appraisal Cycle'),
			'new-feedback':  newDoc('Employee Performance Feedback'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Appraisal'),       icon: '📋', href: '/app/appraisal/new' },
			{ label: __('New Goal'),            icon: '🎯', href: '/app/goal/new' },
			{ label: __('New Appraisal Cycle'), icon: '📅', href: '/app/appraisal-cycle/new' },
			{ label: __('New Feedback'),        icon: '💬', href: '/app/employee-performance-feedback/new' },
			{ label: __('Appraisals'),          icon: '📂', href: '/app/appraisal' },
			{ label: __('Goals'),               icon: '🗂️', href: '/app/goal' },
			{ label: __('KRAs'),                icon: '🏷️', href: '/app/kra' },
			{ label: __('Appraisal Templates'), icon: '📊', href: '/app/appraisal-template' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function fmtScore(v) {
		const n = Number(v || 0);
		return n.toFixed(2);
	}

	function loadData(root) {
		log('loading data from server script: hr_performance_dashboard_data');
		frappe.call({
			method: 'hr_performance_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-perf-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-perf-chart'), data.appraisals_series || []);
				renderRows(root.querySelector('#ce-perf-top'),    data.top_performers || [],     performerRow,  __('No appraisals submitted'));
				renderRows(root.querySelector('#ce-perf-active'), data.active_appraisals || [],  appraisalRow,  __('No active appraisals'));
				renderRows(root.querySelector('#ce-perf-goals'),  data.open_goals || [],         goalRow,       __('No open goals'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-perf-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_performance_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Active appraisals'),     value: (s.active_appraisals || 0),                                   icon: '📋' },
			{ label: __('Open goals'),            value: (s.open_goals || 0),                                          icon: '🎯' },
			{ label: __('Submitted (this month)'), value: (s.submitted_month || 0), delta: s.submitted_delta_pct,       icon: '✅' },
			{ label: __('Avg final score'),       value: fmtScore(s.avg_score),                                        icon: '📊' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No appraisal history'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Appraisals'), values: series.map(p => p.value || 0) }] },
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

	function performerRow(p) {
		return `
			<a class="ce-row" href="/app/employee/${encodeURIComponent(p.employee || '')}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(p.employee_name || p.employee || '')}</div>
					<div class="ce-row-sub">${esc(p.department || p.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtScore(p.avg_score)}</div>
					<div class="ce-row-sub">${esc(String(p.appraisals_count || 0))} ${esc(__('reviews'))}</div>
				</div>
			</a>`;
	}

	function appraisalRow(a) {
		return `
			<a class="ce-row" href="/app/appraisal/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.employee_name || a.employee || a.name)}</div>
					<div class="ce-row-sub">${esc(a.appraisal_cycle || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(a.end_date || '')}</div>
					<div class="ce-row-sub">${esc(__('end date'))}</div>
				</div>
			</a>`;
	}

	function goalRow(g) {
		return `
			<a class="ce-row" href="/app/goal/${encodeURIComponent(g.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(g.goal_name || g.name)}</div>
					<div class="ce-row-sub">${esc(g.employee_name || g.employee || g.kra || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(g.status || '')}</div>
					<div class="ce-row-sub">${esc(g.end_date || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isPerfPath();
		log('tick: isPerfPath =', want, 'mounted =', mounted);
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
			if (isPerfPath() && !document.querySelector('.ce-perf-root')) {
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
				const want = isPerfPath();
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
			if (isPerfPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
