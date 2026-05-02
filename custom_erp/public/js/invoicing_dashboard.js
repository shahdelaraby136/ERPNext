/* Custom ERP — Invoicing Dashboard
   Hijacks /app/invoicing and renders a focused invoicing-only dashboard.

   - URL stays /app/invoicing (Frappe sidebar still highlights "Invoicing")
   - Sales / Purchase invoices + Payment entries + Customers + Suppliers
   - No Journal Entries / Chart of Accounts (those aren't "invoicing")
   - Reuses .ce-hero / .ce-stat / .ce-quick / .ce-split / .ce-panel from custom_theme.css
*/

(function () {
	"use strict";

	const TAG = "[ce-invoicing]";
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

	// ---------- inline CSS — hide native workspace under our render ----------
	function injectStyles() {
		if (document.getElementById("ce-inv-styles")) return;
		// Layout owned by design-system.css via .ds-container + .ds-grid.
		// Only "hide native + free up the main section" rules live here.
		const css = `
			body.ce-inv-active .layout-main-section > *:not(.ce-inv-root) { display: none !important; }
			body.ce-inv-active .ce-inv-root { display: block !important; }
			.layout-main-section:has(> .ce-inv-root) > :not(.ce-inv-root) { display: none !important; }
			.ce-inv-root { padding-bottom: var(--sp-6); }

			body.ce-inv-active .container.page-container,
			body.ce-inv-active .page-container,
			body.ce-inv-active .layout-main,
			body.ce-inv-active .layout-main-section,
			body.ce-inv-active .layout-main-section-wrapper { max-width: none !important; width: 100% !important; }
			body.ce-inv-active .ds-container { max-width: 1600px !important; }
		`;
		const style = document.createElement("style");
		style.id = "ce-inv-styles";
		style.textContent = css;
		document.head.appendChild(style);
	}

	// ---------- route detection ----------
	function isInvoicingPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "invoicing") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		if (p === "/app/invoicing"  || p.startsWith("/app/invoicing/")  || p.startsWith("/app/invoicing?"))  return true;
		if (p === "/desk/invoicing" || p.startsWith("/desk/invoicing/") || p.startsWith("/desk/invoicing?")) return true;
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-inv-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { log("no .layout-main-section yet"); return false; }

		injectStyles();

		let root = layout.querySelector(":scope > .ce-inv-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-inv-root";
			layout.insertBefore(root, layout.firstChild);
		}
		setBodyFlag(true);
		render(root);
		mounted = true;
		log("mounted");
		return true;
	}

	function unmount() {
		mounted = false;
		setBodyFlag(false);
		document.querySelectorAll(".ce-inv-root").forEach(n => n.remove());
		log("unmounted");
	}

	// ---------- render ----------
	function render(root) {
		const today = frappe.datetime.get_today();
		const todayPretty = frappe.datetime.global_date_format
			? frappe.datetime.global_date_format(today)
			: today;

		root.innerHTML = `
			<div class="ce-hero ce-hero-acc">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Invoicing"))}</div>
							<h1 class="ce-hero-title">${esc(t("Invoicing Hub"))}</h1>
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
					<div class="ds-grid" id="ce-inv-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Quick actions"))}</div>
					<div class="ds-grid" id="ce-inv-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Overdue sales invoices"))}</div>
								<a class="ce-panel-link" href="/app/sales-invoice?status=Overdue">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-inv-overdue">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent payments"))}</div>
								<a class="ce-panel-link" href="/app/payment-entry">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-inv-payments">
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

	// ---------- actions ----------
	function bindActions(root) {
		root.querySelector('[data-action="new-sales-invoice"]')   .addEventListener("click", () => frappe.new_doc("Sales Invoice"));
		root.querySelector('[data-action="new-purchase-invoice"]').addEventListener("click", () => frappe.new_doc("Purchase Invoice"));
		root.querySelector('[data-action="new-payment"]')         .addEventListener("click", () => frappe.new_doc("Payment Entry"));
	}

	// ---------- KPI strip ----------
	function renderStats(root, today) {
		const stats = [
			{ key: "unpaid_sales",    label: t("Unpaid sales invoices"),    doctype: "Sales Invoice",    filters: { status: ["in", ["Unpaid", "Overdue", "Partly Paid"]], docstatus: 1 }, icon: "🧾", tone: "indigo", href: "/app/sales-invoice?status=Unpaid" },
			{ key: "overdue_sales",   label: t("Overdue sales invoices"),   doctype: "Sales Invoice",    filters: { status: "Overdue", docstatus: 1 },                                   icon: "⚠️", tone: "rose",   href: "/app/sales-invoice?status=Overdue" },
			{ key: "unpaid_purchase", label: t("Unpaid purchase invoices"), doctype: "Purchase Invoice", filters: { status: ["in", ["Unpaid", "Overdue", "Partly Paid"]], docstatus: 1 }, icon: "📥", tone: "violet", href: "/app/purchase-invoice?status=Unpaid" },
			{ key: "payments_today",  label: t("Payments today"),           doctype: "Payment Entry",    filters: { posting_date: today, docstatus: 1 },                                 icon: "💳", tone: "teal",   href: `/app/payment-entry?posting_date=${today}` },
		];
		const wrap = root.querySelector("#ce-inv-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-inv-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-inv-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-inv-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// ---------- quick action grid (invoicing-focused) ----------
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Sales Invoices"),    icon: "🧾",  tone: "indigo", href: "/app/sales-invoice" },
			{ label: t("Purchase Invoices"), icon: "📥",  tone: "teal",   href: "/app/purchase-invoice" },
			{ label: t("Payment Entries"),   icon: "💳",  tone: "violet", href: "/app/payment-entry" },
			{ label: t("Customers"),         icon: "🧑‍💼", tone: "rose",   href: "/app/customer" },
			{ label: t("Suppliers"),         icon: "🏭",  tone: "slate",  href: "/app/supplier" },
			{ label: t("Credit Notes"),      icon: "↩️",  tone: "amber",  href: "/app/sales-invoice?is_return=1" },
			{ label: t("Debit Notes"),       icon: "↪️",  tone: "amber",  href: "/app/purchase-invoice?is_return=1" },
			{ label: t("Reports"),           icon: "📈",  tone: "green",  href: "/app/query-report/Accounts%20Receivable" },
		];
		const wrap = root.querySelector("#ce-inv-quick");
		// 8 modules at ds-col-3 → 4 per row × 2 rows. Cards line up exactly
		// under the 4 KPI cards above (same 12-col grid).
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	// ---------- overdue / payments lists ----------
	function loadOverdue(root) {
		frappe.db.get_list("Sales Invoice", {
			filters: { status: "Overdue", docstatus: 1 },
			fields:  ["name", "customer_name", "grand_total", "outstanding_amount", "due_date", "currency"],
			order_by: "due_date asc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-inv-overdue");
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
			const body = root.querySelector("#ce-inv-overdue");
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
			const body = root.querySelector("#ce-inv-payments");
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
			const body = root.querySelector("#ce-inv-payments");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load payments"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isInvoicingPath();
		if (want && !mounted) {
			mount();
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			setBodyFlag(true);
		}
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isInvoicingPath() && !document.querySelector(".ce-inv-root")) {
				log("DOM mutated; remounting");
				mount();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isInvoicingPath();
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
			if (isInvoicingPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
