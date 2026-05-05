/* Custom ERP — Insurance Hub
   Hijacks /app/insurance and renders an "Insurance Dashboard" in place.
*/

(function () {
	"use strict";

	const TAG = "[ce-ins]";
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

	// Layout / hero / hide-rules live in insurance_dashboard.css

	function dismissPicker() {
		const candidates = document.querySelectorAll('.modal.show, .modal[style*="display: block"]');
		candidates.forEach(m => {
			if (m.querySelector(".module-link, .workspace-picker, .module-icon")) {
				try {
					if (window.$ && $(m).modal) { $(m).modal("hide"); }
					else { m.classList.remove("show"); m.style.display = "none"; }
					document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
					document.body.classList.remove("modal-open");
				} catch (e) { warn("dismiss failed", e); }
			}
		});
	}

	// ---------- route detection ----------
	function isInsPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "insurance") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/insurance", "/desk/insurance"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-ins-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { return false; }

		let root = layout.querySelector(":scope > .ce-ins-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-ins-root";
			layout.insertBefore(root, layout.firstChild);
		}
		setBodyFlag(true);
		render(root);
		dismissPicker();
		startModalObserver();
		mounted = true;
		log("mounted");
		return true;
	}

	function unmount() {
		mounted = false;
		setBodyFlag(false);
		document.querySelectorAll(".ce-ins-root").forEach(n => n.remove());
		stopModalObserver();
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-ins-active")) dismissPicker();
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

		root.innerHTML = `
			<div class="ce-hero ce-hero-ins">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Insurance Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-claim">
								<span class="ce-ic">📑</span> ${esc(t("Insurance Claim"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-coverage">
								<span class="ce-ic">🛡️</span> ${esc(t("Coverage"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-policy">
								<span class="ce-ic">📜</span> ${esc(t("Policy"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Insurance snapshot"))}</div>
					<div class="ds-grid" id="ce-ins-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-ins-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent insurance claims"))}</div>
								<a class="ce-panel-link" href="/app/insurance-claim">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-ins-claims-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Active coverages"))}</div>
								<a class="ce-panel-link" href="/app/patient-insurance-coverage">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-ins-coverages-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderStats(root);
		renderQuickActions(root);
		loadClaims(root);
		loadCoverages(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-claim"]')   .addEventListener("click", () => frappe.new_doc("Insurance Claim"));
		root.querySelector('[data-action="new-coverage"]').addEventListener("click", () => frappe.new_doc("Patient Insurance Coverage"));
		root.querySelector('[data-action="new-policy"]')  .addEventListener("click", () => frappe.new_doc("Patient Insurance Policy"));
	}

	function renderStats(root) {
		const stats = [
			{ key: "outstanding_claims", label: t("Outstanding claims"), doctype: "Insurance Claim",            filters: { docstatus: 0 },         icon: "📑", tone: "amber",  href: "/app/insurance-claim?docstatus=0" },
			{ key: "submitted_claims",   label: t("Submitted claims"),   doctype: "Insurance Claim",            filters: { docstatus: 1 },         icon: "✅", tone: "violet", href: "/app/insurance-claim?docstatus=1" },
			{ key: "active_coverages",   label: t("Active coverages"),   doctype: "Patient Insurance Coverage", filters: { docstatus: ["<", 2] },  icon: "🛡️", tone: "indigo", href: "/app/patient-insurance-coverage" },
			{ key: "active_policies",    label: t("Active policies"),    doctype: "Patient Insurance Policy",   filters: { docstatus: ["<", 2] },  icon: "📜", tone: "teal",   href: "/app/patient-insurance-policy" },
		];
		const wrap = root.querySelector("#ce-ins-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-ins-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-ins-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-ins-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// 8 doctype cards mirroring the Insurance workspace links
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Insurance Claim"),     icon: "📑", tone: "amber",  href: "/app/insurance-claim" },
			{ label: t("Coverage"),            icon: "🛡️", tone: "indigo", href: "/app/patient-insurance-coverage" },
			{ label: t("Policy"),              icon: "📜", tone: "teal",   href: "/app/patient-insurance-policy" },
			{ label: t("Insurance Payor"),     icon: "🏢", tone: "violet", href: "/app/insurance-payor" },
			{ label: t("Payor Contract"),      icon: "📝", tone: "indigo", href: "/app/insurance-payor-contract" },
			{ label: t("Eligibility Plan"),    icon: "✅", tone: "green",  href: "/app/insurance-payor-eligibility-plan" },
			{ label: t("Item Eligibility"),    icon: "🧾", tone: "rose",   href: "/app/item-insurance-eligibility" },
			{ label: t("Patient"),             icon: "🧑‍⚕️", tone: "slate",  href: "/app/patient" },
		];
		const wrap = root.querySelector("#ce-ins-quick");
		// 8 cards at ds-col-3 = 4 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadClaims(root) {
		frappe.db.get_list("Insurance Claim", {
			filters: { docstatus: ["<", 2] },
			fields:  ["name", "patient", "insurance_payor", "status", "approved_amount"],
			order_by: "creation desc",
			limit: 8,
		}).then(rows => {
			const body = root.querySelector("#ce-ins-claims-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No claims yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => {
				const tone = (r.status === "Paid" || r.status === "Approved") ? "green"
				           : (r.status === "Rejected" || r.status === "Cancelled") ? "slate"
				           : "indigo";
				const amount = r.approved_amount != null ? format_currency(r.approved_amount) : "";
				return `
					<a class="ce-list-row" href="/app/insurance-claim/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">📑</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${esc(r.patient || r.name)}</div>
							<div class="ce-list-sub">${esc(r.insurance_payor || "")}${amount ? " · " + esc(amount) : ""}</div>
						</div>
						<div class="ce-pill ce-pill-${tone}">${esc(r.status || "")}</div>
					</a>
				`;
			}).join("");
		}).catch(err => {
			warn("loadClaims failed", err);
			const body = root.querySelector("#ce-ins-claims-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load claims"))}</div>`;
		});
	}

	function loadCoverages(root) {
		frappe.db.get_list("Patient Insurance Coverage", {
			filters: { docstatus: ["<", 2] },
			fields:  ["name", "patient", "patient_name", "insurance_payor", "status"],
			order_by: "creation desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-ins-coverages-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No coverages yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/patient-insurance-coverage/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">🛡️</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient_name || r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(r.insurance_payor || "")}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadCoverages failed", err);
			const body = root.querySelector("#ce-ins-coverages-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load coverages"))}</div>`;
		});
	}

	function format_currency(v) {
		try { return frappe.format(v, { fieldtype: "Currency" }); }
		catch (e) { return String(v); }
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isInsPath();
		if (want && !mounted) { mount(); }
		else if (!want && mounted) { unmount(); }
		else if (want && mounted) { setBodyFlag(true); dismissPicker(); }
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isInsPath() && !document.querySelector(".ce-ins-root")) { mount(); }
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isInsPath();
				if (!want) { unmount(); }
				else { mounted = false; tick(); }
			});
			return true;
		}
		return false;
	}

	function init() {
		let n = 0;
		const iv = setInterval(() => {
			n++;
			if (bindRouter() || n > 60) {
				clearInterval(iv);
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
			if (isInsPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
