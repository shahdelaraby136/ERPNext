/* Custom Subcontracting Workspace Redesign — same brand theme as Selling
   Hijacks /app/subcontracting and renders Hero + KPIs + Quick Actions + chart + lists.
   Data comes from Server Script: subcontracting_dashboard_data
*/

(function () {
	const TAG = '[ce-sub]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isSubcontractingPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'subcontracting') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/subcontracting' || p.startsWith('/app/subcontracting/') || p.startsWith('/app/subcontracting?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/subcontracting')) return true;
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
		document.body.classList.toggle('ce-sub-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-sub-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-sub-root ce-theme-brand';
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
		document.querySelectorAll('.ce-sub-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();
		const fullName = (window.frappe && frappe.user && frappe.user.full_name && frappe.user.full_name())
			|| (window.frappe && frappe.session && frappe.session.user) || '';

		root.innerHTML = `
			<div class="ce-hero ce-hero-sub">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Subcontracting'))}</div>
							<h1 class="ce-hero-title">${esc(__('Subcontracting Command Center'))}</h1>
							<div class="ce-hero-sub">${esc(__('Welcome'))}, ${esc(fullName)} · ${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-sco">📋 ${esc(__('Subcontracting Order'))}</button>
							<button class="btn ce-hero-btn" data-action="new-sr">📥 ${esc(__('Subcontracting Receipt'))}</button>
							<button class="btn ce-hero-btn" data-action="new-bom">🔧 ${esc(__('Subcontracting BOM'))}</button>
							<button class="btn ce-hero-btn" data-action="new-inward">📦 ${esc(__('Inward Order'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Subcontracting pulse'))}</div>
					<div class="ds-grid" id="ce-sub-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-sub-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Receipts — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/subcontracting-receipt">${esc(__('Receipts'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sub-trend-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Top suppliers (12 mo)'))}</div>
								<a class="ce-panel-link" href="/app/supplier">${esc(__('All suppliers'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sub-top-suppliers">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open subcontracting orders'))}</div>
								<a class="ce-panel-link" href="/app/subcontracting-order">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sub-open-sco">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Recent receipts'))}</div>
								<a class="ce-panel-link" href="/app/subcontracting-receipt">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-sub-recent-sr">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-sub-quick'));
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
			'new-sco':    newDoc('Subcontracting Order'),
			'new-sr':     newDoc('Subcontracting Receipt'),
			'new-bom':    newDoc('Subcontracting BOM'),
			'new-inward': newDoc('Subcontracting Inward Order'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Subcontracting Order'),  icon: '📋', href: '/app/subcontracting-order/new' },
			{ label: __('New Subcontracting Receipt'),icon: '📥', href: '/app/subcontracting-receipt/new' },
			{ label: __('New Subcontracting BOM'),    icon: '🔧', href: '/app/subcontracting-bom/new' },
			{ label: __('New Inward Order'),          icon: '📦', href: '/app/subcontracting-inward-order/new' },
			{ label: __('Suppliers'),                 icon: '🏭', href: '/app/supplier' },
			{ label: __('Items'),                     icon: '🏷️', href: '/app/item' },
			{ label: __('Subcontracting Orders'),     icon: '📂', href: '/app/subcontracting-order' },
			{ label: __('Subcontracting Receipts'),   icon: '🗂️', href: '/app/subcontracting-receipt' },
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
		log('loading data from server script: subcontracting_dashboard_data');
		frappe.call({
			method: 'subcontracting_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-sub-stats'), data.stats || {});
				renderTrendChart(root.querySelector('#ce-sub-trend-chart'), data.receipts_series || []);
				renderRows(root.querySelector('#ce-sub-top-suppliers'), data.top_suppliers || [],              topSupplierRow, __('No supplier activity yet'));
				renderRows(root.querySelector('#ce-sub-open-sco'),       data.open_subcontracting_orders || [], openSCORow,     __('No open subcontracting orders'));
				renderRows(root.querySelector('#ce-sub-recent-sr'),      data.recent_receipts || [],             receiptRow,     __('No receipts yet'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-sub-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "subcontracting_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Open SCOs'),            value: (s.open_sco_count || 0), sub: fmtMoney(s.open_sco_value), icon: '📋' },
			{ label: __('Receipts (this month)'),value: (s.receipts_month || 0), delta: s.receipts_delta_pct,     icon: '📥' },
			{ label: __('Receipt value (month)'),value: fmtMoney(s.receipts_value_month),                          icon: '💰' },
			{ label: __('Active BOMs'),          value: (s.active_boms || 0),                                      icon: '🔧' },
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
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No receipts yet'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Receipts'), values: series.map(p => p.value || 0) }] },
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

	function topSupplierRow(s) {
		return `
			<a class="ce-row" href="/app/supplier/${encodeURIComponent(s.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(s.supplier_name || s.name)}</div>
					<div class="ce-row-sub">${esc(s.supplier_group || '')} · ${Number(s.order_count || 0)} ${esc(__('orders'))}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(s.spend)}</div>
				</div>
			</a>`;
	}

	function openSCORow(o) {
		return `
			<a class="ce-row" href="/app/subcontracting-order/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.name)}</div>
					<div class="ce-row-sub">${esc(o.supplier_name || o.supplier || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(o.total)}</div>
					<div class="ce-row-sub">${esc(o.status || '')}</div>
				</div>
			</a>`;
	}

	function receiptRow(r) {
		return `
			<a class="ce-row" href="/app/subcontracting-receipt/${encodeURIComponent(r.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(r.name)}</div>
					<div class="ce-row-sub">${esc(r.supplier_name || r.supplier || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${fmtMoney(r.total)}</div>
					<div class="ce-row-sub">${esc(r.posting_date || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isSubcontractingPath();
		log('tick: isSubcontractingPath =', want, 'mounted =', mounted);
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
			if (isSubcontractingPath() && !document.querySelector('.ce-sub-root')) {
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
				const want = isSubcontractingPath();
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
			if (isSubcontractingPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
