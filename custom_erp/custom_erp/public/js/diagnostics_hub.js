/* Custom ERP — Diagnostics Hub
   Hijacks /app/diagnostics and renders a "Diagnostics Dashboard" in place.
*/

(function () {
	"use strict";

	const TAG = "[ce-diag]";
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
	function fmtDate(d) {
		try { return frappe.datetime.str_to_user(d); }
		catch (e) { return String(d || ""); }
	}

	// Layout / hero / hide-rules live in diagnostics_dashboard.css

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
	function isDiagPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "diagnostics") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/diagnostics", "/desk/diagnostics"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-diag-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { return false; }

		let root = layout.querySelector(":scope > .ce-diag-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-diag-root";
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
		document.querySelectorAll(".ce-diag-root").forEach(n => n.remove());
		stopModalObserver();
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-diag-active")) dismissPicker();
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
			<div class="ce-hero ce-hero-diag">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Diagnostics Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-report">
								<span class="ce-ic">🧪</span> ${esc(t("Diagnostic Report"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-sample">
								<span class="ce-ic">🩸</span> ${esc(t("Sample Collection"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-observation">
								<span class="ce-ic">🔬</span> ${esc(t("Observation"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Diagnostics snapshot"))}</div>
					<div class="ds-grid" id="ce-diag-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-diag-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent diagnostic reports"))}</div>
								<a class="ce-panel-link" href="/app/diagnostic-report">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-diag-reports-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Pending sample collection"))}</div>
								<a class="ce-panel-link" href="/app/sample-collection">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-diag-samples-list">
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
		loadReports(root);
		loadSamples(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-report"]')     .addEventListener("click", () => frappe.new_doc("Diagnostic Report"));
		root.querySelector('[data-action="new-sample"]')     .addEventListener("click", () => frappe.new_doc("Sample Collection"));
		root.querySelector('[data-action="new-observation"]').addEventListener("click", () => frappe.new_doc("Observation"));
	}

	function renderStats(root, today) {
		const stats = [
			{ key: "open_reports",     label: t("Open diagnostic reports"), doctype: "Diagnostic Report", filters: { docstatus: ["<", 2] },  icon: "🧪", tone: "indigo", href: "/app/diagnostic-report" },
			{ key: "active_orders",    label: t("Active service requests"), doctype: "Service Request",    filters: { docstatus: 1 },         icon: "📋", tone: "violet", href: "/app/service-request" },
			{ key: "pending_samples",  label: t("Pending sample collection"), doctype: "Sample Collection", filters: { docstatus: 0 },        icon: "🩸", tone: "rose",   href: "/app/sample-collection" },
			{ key: "open_obs",         label: t("Open observations"),       doctype: "Observation",        filters: { docstatus: ["<", 2] },  icon: "🔬", tone: "teal",   href: "/app/observation" },
		];
		const wrap = root.querySelector("#ce-diag-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-diag-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-diag-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-diag-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// 8 doctype cards mirroring the Diagnostics workspace links
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Diagnostic Report"),     icon: "🧪", tone: "indigo", href: "/app/diagnostic-report" },
			{ label: t("Observation"),           icon: "🔬", tone: "teal",   href: "/app/observation" },
			{ label: t("Sample Collection"),     icon: "🩸", tone: "rose",   href: "/app/sample-collection" },
			{ label: t("Lab Test"),              icon: "⚗️", tone: "violet", href: "/app/lab-test" },
			{ label: t("Service Request"),       icon: "📋", tone: "amber",  href: "/app/service-request" },
			{ label: t("Patient"),               icon: "🧑‍⚕️", tone: "indigo", href: "/app/patient" },
			{ label: t("Practitioner"),          icon: "🩺", tone: "violet", href: "/app/healthcare-practitioner" },
			{ label: t("Patient History"),       icon: "📜", tone: "slate",  href: "/app/patient-history" },
		];
		const wrap = root.querySelector("#ce-diag-quick");
		// 8 cards at ds-col-3 = 4 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadReports(root) {
		frappe.db.get_list("Diagnostic Report", {
			filters: { docstatus: ["<", 2] },
			fields:  ["name", "patient", "patient_name", "status"],
			order_by: "creation desc",
			limit: 8,
		}).then(rows => {
			const body = root.querySelector("#ce-diag-reports-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No diagnostic reports yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => {
				const tone = (r.status === "Completed") ? "green"
				           : (r.status === "Cancelled") ? "slate" : "indigo";
				return `
					<a class="ce-list-row" href="/app/diagnostic-report/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">🧪</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${esc(r.patient_name || r.patient || r.name)}</div>
							<div class="ce-list-sub">${esc(r.name)}</div>
						</div>
						<div class="ce-pill ce-pill-${tone}">${esc(r.status || "")}</div>
					</a>
				`;
			}).join("");
		}).catch(err => {
			warn("loadReports failed", err);
			const body = root.querySelector("#ce-diag-reports-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load diagnostic reports"))}</div>`;
		});
	}

	function loadSamples(root) {
		frappe.db.get_list("Sample Collection", {
			filters: { docstatus: 0 },
			fields:  ["name", "patient", "patient_name", "sample"],
			order_by: "creation desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-diag-samples-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No pending samples"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/sample-collection/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">🩸</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient_name || r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(r.sample || "")}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadSamples failed", err);
			const body = root.querySelector("#ce-diag-samples-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load samples"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isDiagPath();
		if (want && !mounted) { mount(); }
		else if (!want && mounted) { unmount(); }
		else if (want && mounted) { setBodyFlag(true); dismissPicker(); }
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isDiagPath() && !document.querySelector(".ce-diag-root")) { mount(); }
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isDiagPath();
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
			if (isDiagPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
