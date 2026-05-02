/* Custom Assets Workspace Redesign — same brand theme as Selling
   Hijacks /app/assets and renders a Hero + KPI + module grid + lists.
   Data comes directly from frappe.db.* — no server script required.
*/

(function () {
	const TAG = '[ce-asset]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	// ---------- route detection ----------
	function isAssetPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'assets') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/assets' || p.startsWith('/app/assets/') || p.startsWith('/app/assets?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/assets')) return true;
			return false;
		} catch (e) { log('route check error', e); return false; }
	}

	// ---------- mount / unmount ----------
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
		document.body.classList.toggle('ce-asset-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-asset-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-asset-root ce-theme-brand';
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
		document.querySelectorAll('.ce-asset-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();
		const fullName = (window.frappe && frappe.user && frappe.user.full_name && frappe.user.full_name())
			|| (window.frappe && frappe.session && frappe.session.user) || '';

		root.innerHTML = `
			<div class="ce-hero ce-hero-asset">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Assets'))}</div>
							<h1 class="ce-hero-title">${esc(__('Assets Command Center'))}</h1>
							<div class="ce-hero-sub">${esc(__('Welcome'))}, ${esc(fullName)} · ${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-asset">🏢 ${esc(__('Asset'))}</button>
							<button class="btn ce-hero-btn" data-action="new-movement">🚚 ${esc(__('Movement'))}</button>
							<button class="btn ce-hero-btn" data-action="new-maintenance">🛠️ ${esc(__('Maintenance'))}</button>
							<button class="btn ce-hero-btn" data-action="new-repair">🔧 ${esc(__('Repair'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Asset pulse'))}</div>
					<div class="ds-grid" id="ce-asset-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-asset-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Asset value by category'))}</div>
								<a class="ce-panel-link" href="/app/asset-category">${esc(__('Categories'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-asset-category-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent assets'))}</div>
								<a class="ce-panel-link" href="/app/asset">${esc(__('All assets'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-asset-recent">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent maintenance logs'))}</div>
								<a class="ce-panel-link" href="/app/asset-maintenance-log">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-asset-maintenance">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent movements'))}</div>
								<a class="ce-panel-link" href="/app/asset-movement">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-asset-movements">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-asset-quick'));
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
			'new-asset':       newDoc('Asset'),
			'new-movement':    newDoc('Asset Movement'),
			'new-maintenance': newDoc('Asset Maintenance Log'),
			'new-repair':      newDoc('Asset Repair'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Asset'),          icon: '🏢', href: '/app/asset/new' },
			{ label: __('New Movement'),       icon: '🚚', href: '/app/asset-movement/new' },
			{ label: __('New Maintenance'),    icon: '🛠️', href: '/app/asset-maintenance-log/new' },
			{ label: __('New Repair'),         icon: '🔧', href: '/app/asset-repair/new' },
			{ label: __('Categories'),         icon: '📂', href: '/app/asset-category' },
			{ label: __('Locations'),          icon: '📍', href: '/app/location' },
			{ label: __('Depreciation Ledger'),icon: '📉', href: '/app/query-report/Asset Depreciation Ledger' },
			{ label: __('Asset Activity'),     icon: '📊', href: '/app/query-report/Fixed Asset Register' },
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
		log('loading data from server script: assets_dashboard_data');
		frappe.call({
			method: 'assets_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-asset-stats'), data.stats || {});
				const cats = data.value_by_category || [];
				renderCategoryChart(
					root.querySelector('#ce-asset-category-chart'),
					cats.map(c => c.label),
					cats.map(c => c.value || 0),
				);
				renderRows(root.querySelector('#ce-asset-recent'),       data.recent_assets || [],       assetRow,       __('No assets yet'));
				renderRows(root.querySelector('#ce-asset-maintenance'),  data.maintenance_log_rows || [], maintenanceRow, __('No maintenance logs'));
				renderRows(root.querySelector('#ce-asset-movements'),    data.movements || [],            movementRow,    __('No movements'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-asset-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "assets_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Total assets'),       value: (s.total_assets || 0),     icon: '🏢' },
			{ label: __('Active assets'),      value: (s.active_assets || 0),    icon: '✅' },
			{ label: __('Maintenance logs'),   value: (s.maintenance_logs || 0), icon: '🛠️' },
			{ label: __('Total asset value'),  value: fmtMoney(s.total_value),   icon: '💎' },
		];
		host.innerHTML = cards.map(c => `
			<div class="ds-col-3 ce-card ce-card-brand">
				<div class="ce-card-top">
					<div class="ce-card-icon">${c.icon}</div>
				</div>
				<div class="ce-card-value">${esc(String(c.value))}</div>
				<div class="ce-card-label">${esc(c.label)}</div>
				${c.sub ? `<div class="ce-card-sub">${esc(String(c.sub))}</div>` : ''}
			</div>
		`).join('');
	}

	function renderCategoryChart(el, labels, values) {
		if (!el) return;
		el.innerHTML = '';
		if (!labels.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No asset data'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: {
					labels: labels,
					datasets: [{ name: __('Value'), values: values }],
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

	function assetRow(a) {
		return `
			<a class="ce-row" href="/app/asset/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.asset_name || a.name)}</div>
					<div class="ce-row-sub">${esc(a.asset_category || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(a.purchase_amount)}</div>
					<div class="ce-row-sub">${esc(a.status || '')}</div>
				</div>
			</a>`;
	}

	function maintenanceRow(m) {
		return `
			<a class="ce-row" href="/app/asset-maintenance-log/${encodeURIComponent(m.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(m.asset_name || m.name)}</div>
					<div class="ce-row-sub">${esc(m.maintenance_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(m.maintenance_status || '')}</div>
					<div class="ce-row-sub">${esc(m.completion_date || '')}</div>
				</div>
			</a>`;
	}

	function movementRow(mv) {
		return `
			<a class="ce-row" href="/app/asset-movement/${encodeURIComponent(mv.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(mv.name)}</div>
					<div class="ce-row-sub">${esc(mv.company || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(mv.purpose || '')}</div>
					<div class="ce-row-sub">${esc(mv.transaction_date || '')}</div>
				</div>
			</a>`;
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isAssetPath();
		log('tick: isAssetPath =', want, 'mounted =', mounted);
		if (want && !mounted) {
			if (!mount()) {
				// retry on next animation frame
			}
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			ensureBodyFlag(true);
		}
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isAssetPath() && !document.querySelector('.ce-asset-root')) {
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
				const want = isAssetPath();
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
			if (isAssetPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
