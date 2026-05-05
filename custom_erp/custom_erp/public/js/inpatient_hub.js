/* Custom ERP — Inpatient Hub
   Hijacks /app/inpatient and renders an "Inpatient Dashboard" in place.
   Mirrors outpatient_hub.js / healthcare_hub.js structure.
*/

(function () {
	"use strict";

	const TAG = "[ce-inpatient]";
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

	// Layout / hero / hide-rules live in inpatient_dashboard.css

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
	function isInpatientPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "inpatient") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/inpatient", "/desk/inpatient"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-in-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { return false; }

		let root = layout.querySelector(":scope > .ce-in-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-in-root";
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
		document.querySelectorAll(".ce-in-root").forEach(n => n.remove());
		stopModalObserver();
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-in-active")) dismissPicker();
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
			<div class="ce-hero ce-hero-in">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Inpatient Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-admission">
								<span class="ce-ic">🛏️</span> ${esc(t("Admission"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-med-order">
								<span class="ce-ic">💊</span> ${esc(t("Medication Order"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-discharge">
								<span class="ce-ic">📤</span> ${esc(t("Discharge Summary"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Inpatient snapshot"))}</div>
					<div class="ds-grid" id="ce-in-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-in-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Currently admitted"))}</div>
								<a class="ce-panel-link" href="/app/inpatient-record?status=Admitted">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-in-admitted-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Scheduled admissions"))}</div>
								<a class="ce-panel-link" href="/app/inpatient-record?status=Admission%20Scheduled">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-in-scheduled-list">
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
		loadAdmitted(root);
		loadScheduled(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-admission"]').addEventListener("click", () => frappe.new_doc("Inpatient Record"));
		root.querySelector('[data-action="new-med-order"]').addEventListener("click", () => frappe.new_doc("Inpatient Medication Order"));
		root.querySelector('[data-action="new-discharge"]') .addEventListener("click", () => frappe.new_doc("Discharge Summary"));
	}

	function renderStats(root) {
		const stats = [
			{ key: "admitted",     label: t("Admitted now"),        doctype: "Inpatient Record",            filters: { status: "Admitted" },                                              icon: "🛏️", tone: "violet", href: "/app/inpatient-record?status=Admitted" },
			{ key: "scheduled",    label: t("Scheduled admissions"), doctype: "Inpatient Record",           filters: { status: "Admission Scheduled" },                                   icon: "📅", tone: "indigo", href: "/app/inpatient-record?status=Admission%20Scheduled" },
			{ key: "discharge",    label: t("Pending discharges"),   doctype: "Inpatient Record",           filters: { status: "Discharge Scheduled" },                                   icon: "📤", tone: "amber",  href: "/app/inpatient-record?status=Discharge%20Scheduled" },
			{ key: "active_meds",  label: t("Active medication orders"), doctype: "Inpatient Medication Order", filters: { status: ["in", ["Submitted", "Pending", "In Process"]] },     icon: "💊", tone: "teal",   href: "/app/inpatient-medication-order?status=Submitted" },
		];
		const wrap = root.querySelector("#ce-in-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-in-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-in-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-in-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	function renderQuickActions(root) {
		const actions = [
			{ label: t("Inpatient Record"),      icon: "🛏️", tone: "violet", href: "/app/inpatient-record" },
			{ label: t("Medication Order"),      icon: "💊", tone: "teal",   href: "/app/inpatient-medication-order" },
			{ label: t("Medication Entry"),      icon: "📥", tone: "indigo", href: "/app/inpatient-medication-entry" },
			{ label: t("Discharge Summary"),     icon: "📤", tone: "amber",  href: "/app/discharge-summary" },
			{ label: t("Treatment Counselling"), icon: "🗒️", tone: "rose",   href: "/app/treatment-counselling" },
			{ label: t("Patient Encounter"),     icon: "🩺", tone: "indigo", href: "/app/patient-encounter" },
			{ label: t("Vital Signs"),           icon: "❤️", tone: "rose",   href: "/app/vital-signs" },
			{ label: t("Nursing Task"),          icon: "🩹", tone: "amber",  href: "/app/nursing-task" },
		];
		const wrap = root.querySelector("#ce-in-quick");
		// 8 cards at ds-col-3 = 4 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadAdmitted(root) {
		frappe.db.get_list("Inpatient Record", {
			filters: { status: "Admitted" },
			fields:  ["name", "patient", "admitted_datetime", "expected_discharge"],
			order_by: "admitted_datetime desc",
			limit: 8,
		}).then(rows => {
			const body = root.querySelector("#ce-in-admitted-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No admitted patients"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/inpatient-record/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">🛏️</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(t("Admitted"))} ${esc(fmtDate(r.admitted_datetime))}${r.expected_discharge ? ` · ${esc(t("Discharge"))} ${esc(fmtDate(r.expected_discharge))}` : ""}</div>
					</div>
					<div class="ce-pill ce-pill-violet">${esc(t("Admitted"))}</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadAdmitted failed", err);
			const body = root.querySelector("#ce-in-admitted-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load admitted patients"))}</div>`;
		});
	}

	function loadScheduled(root) {
		frappe.db.get_list("Inpatient Record", {
			filters: { status: "Admission Scheduled" },
			fields:  ["name", "patient", "scheduled_date"],
			order_by: "scheduled_date asc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-in-scheduled-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No scheduled admissions"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/inpatient-record/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">📅</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(fmtDate(r.scheduled_date))}</div>
					</div>
					<div class="ce-pill ce-pill-indigo">${esc(t("Scheduled"))}</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadScheduled failed", err);
			const body = root.querySelector("#ce-in-scheduled-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load scheduled admissions"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isInpatientPath();
		if (want && !mounted) { mount(); }
		else if (!want && mounted) { unmount(); }
		else if (want && mounted) { setBodyFlag(true); dismissPicker(); }
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isInpatientPath() && !document.querySelector(".ce-in-root")) { mount(); }
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isInpatientPath();
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
			if (isInpatientPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
