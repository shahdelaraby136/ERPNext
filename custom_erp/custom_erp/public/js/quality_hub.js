/* Custom Quality Workspace Redesign — same brand theme as Selling
   Hijacks /app/quality and renders Hero + KPIs + inspection trend + lists.
   Data comes from Server Script: quality_dashboard_data
*/

(function () {
	const TAG = '[ce-qual]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isQualityPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'quality') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/quality' || p.startsWith('/app/quality/') || p.startsWith('/app/quality?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/quality')) return true;
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
		document.body.classList.toggle('ce-qual-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-qual-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-qual-root ce-theme-brand';
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
		document.querySelectorAll('.ce-qual-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();
		const fullName = (window.frappe && frappe.user && frappe.user.full_name && frappe.user.full_name())
			|| (window.frappe && frappe.session && frappe.session.user) || '';

		root.innerHTML = `
			<div class="ce-hero ce-hero-qual">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Quality'))}</div>
							<h1 class="ce-hero-title">${esc(__('Quality Command Center'))}</h1>
							<div class="ce-hero-sub">${esc(__('Welcome'))}, ${esc(fullName)} · ${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-inspection">🔍 ${esc(__('Inspection'))}</button>
							<button class="btn ce-hero-btn" data-action="new-nc">⚠️ ${esc(__('Non Conformance'))}</button>
							<button class="btn ce-hero-btn" data-action="new-goal">🎯 ${esc(__('Quality Goal'))}</button>
							<button class="btn ce-hero-btn" data-action="new-procedure">📋 ${esc(__('Procedure'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quality pulse'))}</div>
					<div class="ds-grid" id="ce-qual-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-qual-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Inspections — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/quality-inspection">${esc(__('Inspections'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-qual-trend-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent inspections'))}</div>
								<a class="ce-panel-link" href="/app/quality-inspection">${esc(__('All'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-qual-recent">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open non conformances'))}</div>
								<a class="ce-panel-link" href="/app/non-conformance">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-qual-nc">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open quality actions'))}</div>
								<a class="ce-panel-link" href="/app/quality-action">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-qual-actions">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-qual-quick'));
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
			'new-inspection': newDoc('Quality Inspection'),
			'new-nc':         newDoc('Non Conformance'),
			'new-goal':       newDoc('Quality Goal'),
			'new-procedure':  newDoc('Quality Procedure'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Inspection'),      icon: '🔍', href: '/app/quality-inspection/new' },
			{ label: __('New Non Conformance'), icon: '⚠️', href: '/app/non-conformance/new' },
			{ label: __('New Quality Goal'),    icon: '🎯', href: '/app/quality-goal/new' },
			{ label: __('New Procedure'),       icon: '📋', href: '/app/quality-procedure/new' },
			{ label: __('New Quality Action'),  icon: '🛠️', href: '/app/quality-action/new' },
			{ label: __('New Meeting'),         icon: '👥', href: '/app/quality-meeting/new' },
			{ label: __('New Review'),          icon: '📝', href: '/app/quality-review/new' },
			{ label: __('New Feedback'),        icon: '💬', href: '/app/quality-feedback/new' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function loadData(root) {
		log('loading data from server script: quality_dashboard_data');
		frappe.call({
			method: 'quality_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-qual-stats'), data.stats || {});
				renderTrendChart(root.querySelector('#ce-qual-trend-chart'), data.inspection_series || []);
				renderRows(root.querySelector('#ce-qual-recent'),  data.recent_inspections || [],   inspectionRow, __('No inspections yet'));
				renderRows(root.querySelector('#ce-qual-nc'),      data.open_non_conformances || [], ncRow,         __('No open non conformances'));
				renderRows(root.querySelector('#ce-qual-actions'), data.open_actions || [],          actionRow,     __('No open quality actions'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-qual-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "quality_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Inspections (this month)'), value: (s.inspections_month || 0), delta: s.inspections_delta_pct, icon: '🔍' },
			{ label: __('Rejected (12 mo)'),         value: (s.rejected_count || 0),    icon: '❌' },
			{ label: __('Open non conformances'),    value: (s.open_nc_count || 0),     icon: '⚠️' },
			{ label: __('Open quality actions'),     value: (s.open_actions_count || 0),icon: '🛠️' },
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

	function renderTrendChart(el, series) {
		if (!el) return;
		el.innerHTML = '';
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No inspection data'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Inspections'), values: series.map(p => p.value || 0) }] },
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

	function inspectionRow(q) {
		return `
			<a class="ce-row" href="/app/quality-inspection/${encodeURIComponent(q.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(q.item_name || q.item_code || q.name)}</div>
					<div class="ce-row-sub">${esc(q.inspection_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(q.status || '')}</div>
					<div class="ce-row-sub">${esc(q.report_date || '')}</div>
				</div>
			</a>`;
	}

	function ncRow(n) {
		return `
			<a class="ce-row" href="/app/non-conformance/${encodeURIComponent(n.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(n.name)}</div>
					<div class="ce-row-sub">${esc(n.procedure_name || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(n.status || __('Open'))}</div>
					<div class="ce-row-sub">${esc(n.full_name || '')}</div>
				</div>
			</a>`;
	}

	function actionRow(a) {
		return `
			<a class="ce-row" href="/app/quality-action/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.name)}</div>
					<div class="ce-row-sub">${esc(a.procedure_name || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(a.status || __('Open'))}</div>
					<div class="ce-row-sub">${esc(a.action_date || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isQualityPath();
		log('tick: isQualityPath =', want, 'mounted =', mounted);
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
			if (isQualityPath() && !document.querySelector('.ce-qual-root')) {
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
				const want = isQualityPath();
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
			if (isQualityPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
