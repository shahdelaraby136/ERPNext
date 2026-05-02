/* Custom ERP — Accounting Hub
   Hijacks /app/accounting and renders a clean "Accounting Dashboard" in place.

   - URL stays /app/accounting (sidebar / breadcrumb stay in Accounting context)
   - The native ERPNext "workspace picker" modal is suppressed
   - Title: "Accounting Dashboard"
   - 9 quick-action cards mirror the items in the picker
*/

(function () {
	"use strict";

	const TAG = "[ce-accounting]";
	const log  = function () { try { console.log .apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {} };
	const warn = function () { try { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {} };

	log("script loaded");

	// ---------- helpers ----------
	function esc(s) {
		return String(s == null ? "" : s)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}
	function t(s) { return (window.frappe && frappe._) ? frappe._(s) : s; }
	function fmtMoney(v, currency) {
		try {
			if (typeof format_currency === "function") return format_currency(v || 0, currency);
			return frappe.format(v || 0, { fieldtype: "Currency" });
		} catch (e) { return String(v || 0); }
	}
	function fmtDate(d) {
		try { return frappe.datetime.str_to_user(d); }
		catch (e) { return String(d || ""); }
	}

	// ---------- inline CSS ----------
	function injectStyles() {
		if (document.getElementById("ce-acc-styles")) return;
		// Layout (container width / horizontal padding / grid gutter) is owned
		// by design-system.css via .ds-container + .ds-grid. Only the rules
		// that the design system *can't* express live here:
		//   1. hide the native workspace render under our root
		//   2. let our root span the full main-section width (so .ds-container
		//      can centre itself within whatever space Frappe gives us)
		//   3. dismiss the workspace-picker modal
		const css = `
			body.ce-acc-active .layout-main-section > *:not(.ce-acc-root) { display: none !important; }
			body.ce-acc-active .ce-acc-root { display: block !important; }
			.layout-main-section:has(> .ce-acc-root) > :not(.ce-acc-root) { display: none !important; }
			.ce-acc-root { padding-bottom: var(--sp-6); }

			body.ce-acc-active .container.page-container,
			body.ce-acc-active .page-container,
			body.ce-acc-active .layout-main,
			body.ce-acc-active .layout-main-section,
			body.ce-acc-active .layout-main-section-wrapper { max-width: none !important; width: 100% !important; }
			/* Wider dashboard container — design-system .ds-container caps at
			   1280px which leaves big side margins on widescreen monitors.
			   Bump to 1600px for this hub only. */
			body.ce-acc-active .ds-container { max-width: 1600px !important; }

			body.ce-acc-active .modal[id*="workspace"],
			body.ce-acc-active .modal-dialog .workspace-picker,
			body.ce-acc-active .modal-dialog .modal-content:has(.module-link),
			body.ce-acc-active .modal-backdrop:has(+ .modal .module-link),
			body.ce-acc-active .modal:has(.module-link) { display: none !important; }
		`;
		const style = document.createElement("style");
		style.id = "ce-acc-styles";
		style.textContent = css;
		document.head.appendChild(style);
	}

	// Try to dismiss the workspace-picker modal if it appears anyway.
	function dismissPicker() {
		// Most Frappe modals are closed by clicking the backdrop or pressing Esc.
		const candidates = document.querySelectorAll(
			'.modal.show, .modal[style*="display: block"]'
		);
		candidates.forEach(m => {
			// Only dismiss if it looks like the workspace picker (has module-link items)
			if (m.querySelector(".module-link, .workspace-picker, .module-icon")) {
				try {
					if (window.$ && $(m).modal) { $(m).modal("hide"); }
					else { m.classList.remove("show"); m.style.display = "none"; }
					document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
					document.body.classList.remove("modal-open");
					log("picker dismissed");
				} catch (e) { warn("dismiss failed", e); }
			}
		});
	}

	// ---------- route detection ----------
	function isAccountingPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "accounting" || seg === "accounts") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/accounting", "/app/accounts", "/desk/accounting", "/desk/accounts"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-acc-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { log("no .layout-main-section yet"); return false; }

		injectStyles();

		let root = layout.querySelector(":scope > .ce-acc-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-acc-root";
			layout.insertBefore(root, layout.firstChild);
		}
		setBodyFlag(true);
		render(root);
		dismissPicker(); // in case it's already open
		startModalObserver();
		mounted = true;
		log("mounted");
		return true;
	}

	function unmount() {
		mounted = false;
		setBodyFlag(false);
		document.querySelectorAll(".ce-acc-root").forEach(n => n.remove());
		stopModalObserver();
		log("unmounted");
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-acc-active")) dismissPicker();
		});
		modalObserver.observe(document.body, { childList: true, subtree: true });
	}
	function stopModalObserver() {
		if (modalObserver) { modalObserver.disconnect(); modalObserver = null; }
	}

	// ---------- render ----------
	function render(root) {
		const today = frappe.datetime.get_today();
		const todayPretty = frappe.datetime.global_date_format
			? frappe.datetime.global_date_format(today)
			: today;

		// Single .ds-container wraps every section, guaranteeing identical
		// horizontal edges across hero, KPIs, modules, and split panels.
		// Hero uses a full-bleed background but its inner content sits in
		// the same .ds-container as everything else.
		root.innerHTML = `
			<div class="ce-hero ce-hero-acc">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Accounting"))}</div>
							<h1 class="ce-hero-title">${esc(t("Accounting Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-sales-invoice">
								<span class="ce-ic">🧾</span> ${esc(t("Sales Invoice"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-purchase-invoice">
								<span class="ce-ic">📥</span> ${esc(t("Purchase Invoice"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-payment">
								<span class="ce-ic">💳</span> ${esc(t("Payment Entry"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Financial snapshot"))}</div>
					<div class="ds-grid" id="ce-acc-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-acc-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Overdue sales invoices"))}</div>
								<a class="ce-panel-link" href="/app/sales-invoice?status=Overdue">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-acc-overdue">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent payments"))}</div>
								<a class="ce-panel-link" href="/app/payment-entry">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-acc-payments">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderStats(root, today);
		renderQuickActions(root);
		loadOverdue(root);
		loadPayments(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-sales-invoice"]')   .addEventListener("click", () => frappe.new_doc("Sales Invoice"));
		root.querySelector('[data-action="new-purchase-invoice"]').addEventListener("click", () => frappe.new_doc("Purchase Invoice"));
		root.querySelector('[data-action="new-payment"]')         .addEventListener("click", () => frappe.new_doc("Payment Entry"));
	}

	function renderStats(root, today) {
		const stats = [
			{ key: "unpaid_sales",    label: t("Unpaid sales invoices"),    doctype: "Sales Invoice",    filters: { status: ["in", ["Unpaid", "Overdue", "Partly Paid"]], docstatus: 1 }, icon: "🧾", tone: "indigo", href: "/app/sales-invoice?status=Unpaid" },
			{ key: "overdue_sales",   label: t("Overdue sales invoices"),   doctype: "Sales Invoice",    filters: { status: "Overdue", docstatus: 1 },                                   icon: "⚠️", tone: "rose",   href: "/app/sales-invoice?status=Overdue" },
			{ key: "unpaid_purchase", label: t("Unpaid purchase invoices"), doctype: "Purchase Invoice", filters: { status: ["in", ["Unpaid", "Overdue", "Partly Paid"]], docstatus: 1 }, icon: "📥", tone: "violet", href: "/app/purchase-invoice?status=Unpaid" },
			{ key: "payments_today",  label: t("Payments today"),           doctype: "Payment Entry",    filters: { posting_date: today, docstatus: 1 },                                 icon: "💳", tone: "teal",   href: `/app/payment-entry?posting_date=${today}` },
		];
		const wrap = root.querySelector("#ce-acc-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-acc-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-acc-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-acc-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// 9 modules from the original Accounting workspace picker
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Invoicing"),         icon: "🧾", tone: "indigo", href: "/app/invoicing" },
			{ label: t("Payments"),          icon: "💳", tone: "violet", href: "/app/payment-entry" },
			{ label: t("Financial Reports"), icon: "📊", tone: "teal",   href: "/app/financial-reports" },
			{ label: t("Accounts Setup"),    icon: "⚙️", tone: "slate",  href: "/app/accounts-settings" },
			{ label: t("Taxes"),             icon: "%",  tone: "amber",  href: "/app/tax-rule" },
			{ label: t("Banking"),           icon: "🏦", tone: "indigo", href: "/app/bank-transaction" },
			{ label: t("Budget"),            icon: "💰", tone: "green",  href: "/app/budget" },
			{ label: t("Share Management"),  icon: "📈", tone: "violet", href: "/app/shareholder" },
			{ label: t("Subscription"),      icon: "🔁", tone: "rose",   href: "/app/subscription" },
		];
		const wrap = root.querySelector("#ce-acc-quick");
		// 9 modules at ds-col-3 = 4 per row → 3 rows (3rd row = 1 item).
		// Better aesthetic: ds-col-4 → 3 per row × 3 rows. Sticking with
		// ds-col-3 to align with KPI cards above on the same 12-col grid.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadOverdue(root) {
		frappe.db.get_list("Sales Invoice", {
			filters: { status: "Overdue", docstatus: 1 },
			fields:  ["name", "customer_name", "grand_total", "outstanding_amount", "due_date", "currency"],
			order_by: "due_date asc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-acc-overdue");
			if (!body) return;
			body.innerHTML = "";
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No overdue invoices 🎉"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/sales-invoice/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">⚠️</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.customer_name || r.name)}</div>
						<div class="ce-list-sub">${esc(t("Due"))} ${esc(fmtDate(r.due_date))}</div>
					</div>
					<div class="ce-pill ce-pill-red">${fmtMoney(r.outstanding_amount, r.currency)}</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadOverdue failed", err);
			const body = root.querySelector("#ce-acc-overdue");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load invoices"))}</div>`;
		});
	}

	function loadPayments(root) {
		frappe.db.get_list("Payment Entry", {
			filters: { docstatus: 1 },
			fields:  ["name", "party", "paid_amount", "posting_date", "payment_type", "paid_from_account_currency"],
			order_by: "posting_date desc, creation desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-acc-payments");
			if (!body) return;
			body.innerHTML = "";
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No payments yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => {
				const tone = r.payment_type === "Receive" ? "green" : "indigo";
				return `
					<a class="ce-list-row" href="/app/payment-entry/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">💳</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${esc(r.party || r.name)}</div>
							<div class="ce-list-sub">${esc(fmtDate(r.posting_date))} · ${esc(r.payment_type || "")}</div>
						</div>
						<div class="ce-pill ce-pill-${tone}">${fmtMoney(r.paid_amount, r.paid_from_account_currency)}</div>
					</a>
				`;
			}).join("");
		}).catch(err => {
			warn("loadPayments failed", err);
			const body = root.querySelector("#ce-acc-payments");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load payments"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isAccountingPath();
		if (want && !mounted) {
			mount();
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			setBodyFlag(true);
			dismissPicker();
		}
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isAccountingPath() && !document.querySelector(".ce-acc-root")) {
				mount();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isAccountingPath();
				if (!want) { unmount(); }
				else { mounted = false; tick(); }
			});
			log("router bound");
			return true;
		}
		return false;
	}

	function init() {
		log("init; readyState:", document.readyState);
		let n = 0;
		const iv = setInterval(() => {
			n++;
			if (bindRouter() || n > 60) {
				clearInterval(iv);
				if (n > 60) warn("frappe.router never available");
				startObserver();
				tick();
			}
		}, 100);

		window.addEventListener("load", () => setTimeout(tick, 200));

		let attempts = 0;
		const retry = setInterval(() => {
			attempts++;
			if (attempts > 50) { clearInterval(retry); return; }
			if (mounted) { clearInterval(retry); return; }
			if (isAccountingPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
