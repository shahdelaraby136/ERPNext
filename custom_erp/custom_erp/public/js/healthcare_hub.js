/* Custom ERP — Healthcare Hub
   Hijacks /app/healthcare and renders a clean "Healthcare Dashboard" in place.

   - URL stays /app/healthcare (sidebar / breadcrumb stay in Healthcare context)
   - The native ERPNext "workspace picker" modal is suppressed
   - Title: "Healthcare Dashboard"
   - Hero quick actions: New Patient, New Appointment, New Encounter
   - 4 KPIs: today's appointments, admitted inpatients, pending lab tests, open service requests
   - 6 module cards mirror Marley Health workspaces: Outpatient, Inpatient,
     Diagnostics, Rehabilitation, Insurance, Setup
*/

(function () {
	"use strict";

	const TAG = "[ce-healthcare]";
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

	// Layout / hero / hide-rules live in healthcare_dashboard.css

	function dismissPicker() {
		const candidates = document.querySelectorAll(
			'.modal.show, .modal[style*="display: block"]'
		);
		candidates.forEach(m => {
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
	function isHealthcarePath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "healthcare") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/healthcare", "/desk/healthcare"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-hc-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { log("no .layout-main-section yet"); return false; }

		let root = layout.querySelector(":scope > .ce-hc-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-hc-root";
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
		document.querySelectorAll(".ce-hc-root").forEach(n => n.remove());
		stopModalObserver();
		log("unmounted");
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-hc-active")) dismissPicker();
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
			<div class="ce-hero ce-hero-hc">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Healthcare Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-patient">
								<span class="ce-ic">👤</span> ${esc(t("Patient"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-appointment">
								<span class="ce-ic">📅</span> ${esc(t("Appointment"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-encounter">
								<span class="ce-ic">🩺</span> ${esc(t("Encounter"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Clinical snapshot"))}</div>
					<div class="ds-grid" id="ce-hc-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-hc-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Today's appointments"))}</div>
								<a class="ce-panel-link" href="/app/patient-appointment?appointment_date=${today}">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-hc-appts">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Admitted inpatients"))}</div>
								<a class="ce-panel-link" href="/app/inpatient-record?status=Admitted">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-hc-inpatients">
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
		loadInpatients(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-patient"]')    .addEventListener("click", () => frappe.new_doc("Patient"));
		root.querySelector('[data-action="new-appointment"]').addEventListener("click", () => frappe.new_doc("Patient Appointment"));
		root.querySelector('[data-action="new-encounter"]')  .addEventListener("click", () => frappe.new_doc("Patient Encounter"));
	}

	function renderStats(root, today) {
		const stats = [
			{ key: "appts_today",    label: t("Today's appointments"), doctype: "Patient Appointment", filters: { appointment_date: today },                          icon: "📅", tone: "indigo", href: `/app/patient-appointment?appointment_date=${today}` },
			{ key: "admitted",       label: t("Admitted inpatients"),  doctype: "Inpatient Record",    filters: { status: "Admitted" },                                icon: "🛏️", tone: "violet", href: "/app/inpatient-record?status=Admitted" },
			{ key: "pending_labs",   label: t("Pending lab tests"),    doctype: "Lab Test",            filters: { status: ["in", ["Open", "In Progress"]] },           icon: "🧪", tone: "teal",   href: "/app/lab-test?status=Open" },
			{ key: "open_requests",  label: t("Open service requests"), doctype: "Service Request",    filters: { status: ["in", ["Active", "Draft", "On Hold"]] },    icon: "📋", tone: "amber",  href: "/app/service-request?status=Active" },
		];
		const wrap = root.querySelector("#ce-hc-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-hc-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-hc-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-hc-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// 6 sub-workspaces inside Marley Health
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Outpatient"),     icon: "🩺", tone: "indigo", href: "/app/outpatient" },
			{ label: t("Inpatient"),      icon: "🛏️", tone: "violet", href: "/app/inpatient" },
			{ label: t("Diagnostics"),    icon: "🧪", tone: "teal",   href: "/app/diagnostics" },
			{ label: t("Rehabilitation"), icon: "💪", tone: "rose",   href: "/app/rehabilitation" },
			{ label: t("Insurance"),      icon: "🛡️", tone: "amber",  href: "/app/insurance" },
			{ label: t("Setup"),          icon: "⚙️", tone: "slate",  href: "/app/setup" },
		];
		const wrap = root.querySelector("#ce-hc-quick");
		// 6 cards at ds-col-4 = 3 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-4 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
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
			const body = root.querySelector("#ce-hc-appts");
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
			const body = root.querySelector("#ce-hc-appts");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load appointments"))}</div>`;
		});
	}

	function loadInpatients(root) {
		frappe.db.get_list("Inpatient Record", {
			filters: { status: "Admitted" },
			fields:  ["name", "patient", "admitted_datetime"],
			order_by: "admitted_datetime desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-hc-inpatients");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No admitted inpatients"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/inpatient-record/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">🛏️</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(fmtDate(r.admitted_datetime))}</div>
					</div>
					<div class="ce-pill ce-pill-violet">${esc(t("Admitted"))}</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadInpatients failed", err);
			const body = root.querySelector("#ce-hc-inpatients");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load inpatients"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isHealthcarePath();
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
			if (isHealthcarePath() && !document.querySelector(".ce-hc-root")) {
				mount();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isHealthcarePath();
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
			if (isHealthcarePath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
