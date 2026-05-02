/* Custom Selling Workspace Redesign — RED theme
   Hijacks /app/selling and renders a custom dashboard.
   Data comes from a Server Script API: selling_dashboard_data
*/

(function () {
	const TAG = '[ce-sell]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',  // matches design-system --primary
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	// ---------- route detection ----------
	function isSellingPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			log('route check — pathname:', path, 'hash:', hash, 'frappe.get_route():', JSON.stringify(r));

			// 1) Frappe router state (most reliable once router is alive)
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'selling') return true;
			}
			// 2) URL pathname fallback
			const p = path.toLowerCase();
			if (p === '/app/selling' || p.startsWith('/app/selling/') || p.startsWith('/app/selling?')) return true;
			// 3) Old-style hash fallback (#desk/selling)
			const h = hash.toLowerCase();
			if (h.includes('selling')) return true;
			return false;
		} catch (e) { log('route check error', e); return false; }
	}

	// ---------- mount / unmount ----------
	let observer = null;
	let mounted = false;

	function findHost() {
		// Try the most specific Frappe v15 workspace containers first
		const candidates = [
			'.layout-main-section .desk-page',          // workspace block editor wrapper
			'.layout-main-section .codex-editor',       // block editor itself
			'.layout-main-section .workspace-tab',      // tabbed workspace
			'.layout-main-section .container',          // inner container
			'.layout-main-section',                     // fallback: whole layout
		];
		for (const sel of candidates) {
			const el = document.querySelector(sel);
			if (el) return { el, sel };
		}
		return null;
	}

	function ensureBodyFlag(on) {
		document.body.classList.toggle('ce-sell-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		// Insert our root as a sibling INSIDE .layout-main-section so it's at the top
		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-sell-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-sell-root ce-theme-brand';
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
		document.querySelectorAll('.ce-sell-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();
		const fullName = (window.frappe && frappe.user && frappe.user.full_name && frappe.user.full_name())
			|| (window.frappe && frappe.session && frappe.session.user) || '';

		root.innerHTML = `
			<div class="ce-hero ce-hero-sell">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Selling'))}</div>
							<h1 class="ce-hero-title">${esc(__('Sales Command Center'))}</h1>
							<div class="ce-hero-sub">${esc(__('Welcome'))}, ${esc(fullName)} · ${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-quotation">📝 ${esc(__('Quotation'))}</button>
							<button class="btn ce-hero-btn" data-action="new-sales-order">📦 ${esc(__('Sales Order'))}</button>
							<button class="btn ce-hero-btn" data-action="new-sales-invoice">🧾 ${esc(__('Sales Invoice'))}</button>
							<button class="btn ce-hero-btn" data-action="new-customer">👤 ${esc(__('Customer'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Sales pulse'))}</div>
					<div class="ds-grid" id="ce-sell-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-sell-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Revenue — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/sales-invoice">${esc(__('Invoices'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sell-revenue-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top customers (health score)'))}</div>
								<a class="ce-panel-link" href="/app/customer">${esc(__('All customers'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sell-top-customers">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open sales orders'))}</div>
								<a class="ce-panel-link" href="/app/sales-order">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sell-open-so">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Overdue invoices'))}</div>
								<a class="ce-panel-link" href="/app/sales-invoice?status=Overdue">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sell-overdue">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-sell-quick'));
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
			'new-quotation':     newDoc('Quotation'),
			'new-sales-order':   newDoc('Sales Order'),
			'new-sales-invoice': newDoc('Sales Invoice'),
			'new-customer':      newDoc('Customer'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Quotation'),    icon: '📝', href: '/app/quotation/new?quotation_to=Customer' },
			{ label: __('New Sales Order'),  icon: '📦', href: '/app/sales-order/new' },
			{ label: __('New Invoice'),      icon: '🧾', href: '/app/sales-invoice/new' },
			{ label: __('Customers'),        icon: '👥', href: '/app/customer' },
			{ label: __('Items'),            icon: '🏷️', href: '/app/item' },
			{ label: __('Price Lists'),      icon: '💵', href: '/app/price-list' },
			{ label: __('Sales Analytics'),  icon: '📊', href: '/app/query-report/Sales Analytics' },
			{ label: __('Sales Funnel'),     icon: '🪜', href: '/app/dashboard-view' },
		];
		// 8 quick actions × ds-col-3 = 4 per row × 2 rows. Aligned to the
		// same 12-col grid as KPI cards above.
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
			// frappe.format() returns wrapped HTML — strip it so escaped renders show plain text.
			return String(frappe.format(v || 0, { fieldtype: 'Currency' })).replace(/<[^>]+>/g, '');
		} catch (e) { return (v || 0).toLocaleString(); }
	}

	function loadData(root) {
		log('loading data from server script: selling_dashboard_data');
		frappe.call({
			method: 'selling_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-sell-stats'), data.stats || {});
				renderRevenueChart(root.querySelector('#ce-sell-revenue-chart'), data.revenue_series || []);
				renderRows(root.querySelector('#ce-sell-top-customers'), data.top_customers || [], topCustomerRow, __('No customers found'));
				renderRows(root.querySelector('#ce-sell-open-so'),       data.open_sales_orders || [], openSORow,    __('No open sales orders'));
				renderRows(root.querySelector('#ce-sell-overdue'),       data.overdue_invoices || [], overdueRow,   __('No overdue invoices'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-sell-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "selling_dashboard_data" is enabled.'))}</div>`;
			}
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Revenue (this month)'), value: fmtMoney(s.revenue_month), delta: s.revenue_delta_pct, icon: '💰' },
			{ label: __('Open sales orders'),    value: (s.open_so_count || 0),     sub: fmtMoney(s.open_so_value),  icon: '📦' },
			{ label: __('Overdue invoices'),     value: (s.overdue_count  || 0),    sub: fmtMoney(s.overdue_value),  icon: '⚠️' },
			{ label: __('Active customers'),     value: (s.active_customers || 0),  sub: __('last 90 days'),         icon: '👥' },
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

	function renderRevenueChart(el, series) {
		if (!el) return;
		el.innerHTML = '';
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No revenue data'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'line',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				lineOptions: { regionFill: 1 },
				axisOptions: { xAxisMode: 'tick' },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Revenue'), values: series.map(p => p.value || 0) }] },
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

	function topCustomerRow(c) {
		return `
			<a class="ce-row" href="/app/customer/${encodeURIComponent(c.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(c.customer_name || c.name)}</div>
					<div class="ce-row-sub">${esc(c.territory || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-score" data-score="${Number(c.health_score || 0).toFixed(0)}">${Number(c.health_score || 0).toFixed(0)}</div>
				</div>
			</a>`;
	}

	function openSORow(o) {
		return `
			<a class="ce-row" href="/app/sales-order/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.name)}</div>
					<div class="ce-row-sub">${esc(o.customer_name || o.customer || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(o.grand_total)}</div>
					<div class="ce-row-sub">${esc(o.status || '')}</div>
				</div>
			</a>`;
	}

	function overdueRow(o) {
		return `
			<a class="ce-row" href="/app/sales-invoice/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.name)}</div>
					<div class="ce-row-sub">${esc(o.customer_name || o.customer || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(o.outstanding_amount)}</div>
					<div class="ce-row-sub">${esc(o.due_date || '')}</div>
				</div>
			</a>`;
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isSellingPath();
		log('tick: isSellingPath =', want, 'mounted =', mounted);
		if (want && !mounted) {
			if (!mount()) {
				// retry on next animation frame; mutation observer will catch DOM later
			}
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			// Already mounted — make sure body flag is on
			ensureBodyFlag(true);
		}
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isSellingPath() && !document.querySelector('.ce-sell-root')) {
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
				// If we leave selling, unmount; if we enter, allow re-mount
				const want = isSellingPath();
				if (!want) { unmount(); }
				else { mounted = false; tick(); }
			});
			log('router bound');
			// Also subscribe to app_ready / page changes (some Frappe versions fire 'app_ready')
			if (typeof frappe.realtime !== 'undefined') { /* nothing — placeholder */ }
			return true;
		}
		return false;
	}

	function init() {
		log('init starting; readyState:', document.readyState);
		// poll for frappe.router
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

		// Also ensure first paint after window load
		window.addEventListener('load', () => setTimeout(tick, 200));
		// And keep retrying for up to 10 seconds in case the router fires its first
		// 'change' before we manage to subscribe.
		let attempts = 0;
		const retry = setInterval(() => {
			attempts++;
			if (attempts > 50) { clearInterval(retry); return; }
			if (mounted) { clearInterval(retry); return; }
			if (isSellingPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
