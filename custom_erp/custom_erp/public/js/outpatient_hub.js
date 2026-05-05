/* Custom ERP — Outpatient Hub
   Hijacks /app/outpatient and renders an "Outpatient Dashboard" in place.
   Mirrors healthcare_hub.js / accounting_hub.js structure.
*/

(function () {
	"use strict";

	const TAG = "[ce-outpatient]";
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
	function fmtTime(t_) {
		if (!t_) return "";
		try {
			const s = String(t_);
			const m = s.match(/^(\d{2}):(\d{2})/);
			if (m) return `${m[1]}:${m[2]}`;
			return s;
		} catch (e) { return String(t_ || ""); }
	}

	// Layout / hero / hide-rules live in outpatient_dashboard.css

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
	function isOutpatientPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "outpatient") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/outpatient", "/desk/outpatient"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-out-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { return false; }

		let root = layout.querySelector(":scope > .ce-out-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-out-root";
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
		document.querySelectorAll(".ce-out-root").forEach(n => n.remove());
		stopModalObserver();
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-out-active")) dismissPicker();
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
			<div class="ce-hero ce-hero-out">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Outpatient Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-appointment">
								<span class="ce-ic">📅</span> ${esc(t("Appointment"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-encounter">
								<span class="ce-ic">🩺</span> ${esc(t("Encounter"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-service-request">
								<span class="ce-ic">📋</span> ${esc(t("Service Request"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Outpatient snapshot"))}</div>
					<div class="ds-grid" id="ce-out-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-out-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Today's appointments"))}</div>
								<a class="ce-panel-link" href="/app/patient-appointment?appointment_date=${today}">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-out-appts">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent encounters"))}</div>
								<a class="ce-panel-link" href="/app/patient-encounter">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-out-encounters">
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
		loadAppointments(root, today);
		loadEncounters(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-appointment"]')    .addEventListener("click", () => frappe.new_doc("Patient Appointment"));
		root.querySelector('[data-action="new-encounter"]')      .addEventListener("click", () => frappe.new_doc("Patient Encounter"));
		root.querySelector('[data-action="new-service-request"]').addEventListener("click", () => frappe.new_doc("Service Request"));
	}

	function renderStats(root, today) {
		const stats = [
			{ key: "appts_today",     label: t("Today's appointments"), doctype: "Patient Appointment", filters: { appointment_date: today },                 icon: "📅", tone: "indigo", href: `/app/patient-appointment?appointment_date=${today}` },
			{ key: "encounters_today", label: t("Today's encounters"),   doctype: "Patient Encounter",   filters: { encounter_date: today },                   icon: "🩺", tone: "violet", href: `/app/patient-encounter?encounter_date=${today}` },
			{ key: "active_orders",    label: t("Active service requests"), doctype: "Service Request",  filters: { docstatus: 1 },                            icon: "📋", tone: "teal",   href: "/app/service-request" },
			{ key: "pending_nursing",  label: t("Pending nursing tasks"), doctype: "Nursing Task",       filters: { status: ["in", ["Requested", "Accepted", "Ready", "In Progress", "On Hold"]] }, icon: "🩹", tone: "amber", href: "/app/nursing-task?status=Requested" },
		];
		const wrap = root.querySelector("#ce-out-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-out-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-out-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-out-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// 8 doctype cards mirroring the Outpatient workspace links
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Patient Appointment"), icon: "📅", tone: "indigo", href: "/app/patient-appointment" },
			{ label: t("Patient Encounter"),   icon: "🩺", tone: "violet", href: "/app/patient-encounter" },
			{ label: t("Vital Signs"),         icon: "❤️", tone: "rose",   href: "/app/vital-signs" },
			{ label: t("Nursing Task"),        icon: "🩹", tone: "amber",  href: "/app/nursing-task" },
			{ label: t("Service Request"),     icon: "📋", tone: "teal",   href: "/app/service-request" },
			{ label: t("Medication Request"),  icon: "💊", tone: "indigo", href: "/app/medication-request" },
			{ label: t("Clinical Note"),       icon: "📝", tone: "slate",  href: "/app/clinical-note" },
			{ label: t("Fee Validity"),        icon: "💰", tone: "green",  href: "/app/fee-validity" },
		];
		const wrap = root.querySelector("#ce-out-quick");
		// 8 cards at ds-col-3 = 4 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadAppointments(root, today) {
		frappe.db.get_list("Patient Appointment", {
			filters: { appointment_date: today },
			fields:  ["name", "patient", "department", "appointment_time", "status"],
			order_by: "appointment_time asc",
			limit: 8,
		}).then(rows => {
			const body = root.querySelector("#ce-out-appts");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No appointments today"))}</div>`; return; }
			body.innerHTML = rows.map(r => {
				const tone = (r.status === "Closed" || r.status === "Cancelled") ? "slate"
				           : (r.status === "Open") ? "green" : "indigo";
				return `
					<a class="ce-list-row" href="/app/patient-appointment/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">📅</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${esc(r.patient || r.name)}</div>
							<div class="ce-list-sub">${esc(fmtTime(r.appointment_time))} · ${esc(r.department || "")}</div>
						</div>
						<div class="ce-pill ce-pill-${tone}">${esc(r.status || "")}</div>
					</a>
				`;
			}).join("");
		}).catch(err => {
			warn("loadAppointments failed", err);
			const body = root.querySelector("#ce-out-appts");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load appointments"))}</div>`;
		});
	}

	function loadEncounters(root) {
		frappe.db.get_list("Patient Encounter", {
			filters: { docstatus: ["<", 2] },
			fields:  ["name", "encounter_date", "practitioner_name"],
			order_by: "encounter_date desc, creation desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-out-encounters");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No encounters yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/patient-encounter/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">🩺</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.name)}</div>
						<div class="ce-list-sub">${esc(fmtDate(r.encounter_date))} · ${esc(r.practitioner_name || "")}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadEncounters failed", err);
			const body = root.querySelector("#ce-out-encounters");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load encounters"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isOutpatientPath();
		if (want && !mounted) { mount(); }
		else if (!want && mounted) { unmount(); }
		else if (want && mounted) { setBodyFlag(true); dismissPicker(); }
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isOutpatientPath() && !document.querySelector(".ce-out-root")) { mount(); }
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isOutpatientPath();
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
			if (isOutpatientPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
