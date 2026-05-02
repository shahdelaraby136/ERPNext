/* Custom Stock Workspace Redesign — same brand theme as Selling
   Hijacks /app/stock and renders Hero + KPIs + Quick Actions + chart + lists.
   Data comes from Server Script: stock_dashboard_data
*/

(function () {
	const TAG = '[ce-stock]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isStockPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'stock') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/stock' || p.startsWith('/app/stock/') || p.startsWith('/app/stock?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/stock')) return true;
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
		document.body.classList.toggle('ce-stock-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-stock-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-stock-root ce-theme-brand';
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
		document.querySelectorAll('.ce-stock-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();
		const fullName = (window.frappe && frappe.user && frappe.user.full_name && frappe.user.full_name())
			|| (window.frappe && frappe.session && frappe.session.user) || '';

		root.innerHTML = `
			<div class="ce-hero ce-hero-stock">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Stock'))}</div>
							<h1 class="ce-hero-title">${esc(__('Stock Command Center'))}</h1>
							<div class="ce-hero-sub">${esc(__('Welcome'))}, ${esc(fullName)} · ${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-stock-entry">📦 ${esc(__('Stock Entry'))}</button>
							<button class="btn ce-hero-btn" data-action="new-mr">📝 ${esc(__('Material Request'))}</button>
							<button class="btn ce-hero-btn" data-action="new-dn">🚚 ${esc(__('Delivery Note'))}</button>
							<button class="btn ce-hero-btn" data-action="new-pr">📥 ${esc(__('Purchase Receipt'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Stock pulse'))}</div>
					<div class="ds-grid" id="ce-stock-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-stock-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Stock entries — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/stock-entry">${esc(__('Stock Entries'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-stock-trend-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top warehouses'))}</div>
								<a class="ce-panel-link" href="/app/warehouse">${esc(__('All warehouses'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-stock-top-warehouses">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Pending material requests'))}</div>
								<a class="ce-panel-link" href="/app/material-request">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-stock-pending-mr">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent stock entries'))}</div>
								<a class="ce-panel-link" href="/app/stock-entry">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-stock-recent-se">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-stock-quick'));
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
			'new-stock-entry': newDoc('Stock Entry'),
			'new-mr':          newDoc('Material Request'),
			'new-dn':          newDoc('Delivery Note'),
			'new-pr':          newDoc('Purchase Receipt'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Stock Entry'),    icon: '📦', href: '/app/stock-entry/new' },
			{ label: __('New Material Request'),icon: '📝', href: '/app/material-request/new' },
			{ label: __('New Delivery Note'),  icon: '🚚', href: '/app/delivery-note/new' },
			{ label: __('New Purchase Receipt'),icon: '📥', href: '/app/purchase-receipt/new' },
			{ label: __('Items'),              icon: '🏷️', href: '/app/item' },
			{ label: __('Warehouses'),         icon: '🏬', href: '/app/warehouse' },
			{ label: __('Stock Balance'),      icon: '⚖️', href: '/app/query-report/Stock Balance' },
			{ label: __('Stock Ledger'),       icon: '📒', href: '/app/query-report/Stock Ledger' },
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
		log('loading data from server script: stock_dashboard_data');
		frappe.call({
			method: 'stock_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-stock-stats'), data.stats || {});
				renderTrendChart(root.querySelector('#ce-stock-trend-chart'), data.stock_entry_series || []);
				renderRows(root.querySelector('#ce-stock-top-warehouses'), data.top_warehouses || [],            warehouseRow, __('No stock yet'));
				renderRows(root.querySelector('#ce-stock-pending-mr'),     data.pending_material_requests || [], mrRow,        __('No pending material requests'));
				renderRows(root.querySelector('#ce-stock-recent-se'),      data.recent_stock_entries || [],      stockEntryRow,__('No stock entries'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-stock-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "stock_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Inventory value'),      value: fmtMoney(s.inventory_value), icon: '💎' },
			{ label: __('Stock items'),          value: (s.stock_items || 0),         icon: '🏷️' },
			{ label: __('Pending material requests'), value: (s.pending_mr || 0),     icon: '📝' },
			{ label: __('Stock entries (this month)'), value: (s.se_month || 0), delta: s.se_delta_pct, icon: '📦' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No stock entries yet'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Stock Entries'), values: series.map(p => p.value || 0) }] },
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

	function warehouseRow(w) {
		return `
			<a class="ce-row" href="/app/warehouse/${encodeURIComponent(w.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(w.warehouse_name || w.name)}</div>
					<div class="ce-row-sub">${esc(w.company || '')} · ${Number(w.item_count || 0)} ${esc(__('items'))}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(w.stock_value)}</div>
				</div>
			</a>`;
	}

	function mrRow(m) {
		return `
			<a class="ce-row" href="/app/material-request/${encodeURIComponent(m.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(m.name)}</div>
					<div class="ce-row-sub">${esc(m.material_request_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(m.status || '')}</div>
					<div class="ce-row-sub">${esc(m.schedule_date || m.transaction_date || '')}</div>
				</div>
			</a>`;
	}

	function stockEntryRow(s) {
		return `
			<a class="ce-row" href="/app/stock-entry/${encodeURIComponent(s.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(s.name)}</div>
					<div class="ce-row-sub">${esc(s.stock_entry_type || s.purpose || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(s.posting_date || '')}</div>
					<div class="ce-row-sub">${esc(s.company || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isStockPath();
		log('tick: isStockPath =', want, 'mounted =', mounted);
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
			if (isStockPath() && !document.querySelector('.ce-stock-root')) {
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
				const want = isStockPath();
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
			if (isStockPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
