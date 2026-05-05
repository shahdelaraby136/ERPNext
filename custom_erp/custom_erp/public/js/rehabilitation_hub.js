/* Custom ERP — Rehabilitation Hub
   Hijacks /app/rehabilitation and renders a "Rehabilitation Dashboard" in place.
*/

(function () {
	"use strict";

	const TAG = "[ce-rehab]";
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

	// Layout / hero / hide-rules live in rehabilitation_dashboard.css

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
	function isRehabPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "rehabilitation") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/rehabilitation", "/desk/rehabilitation"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-rehab-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { return false; }

		let root = layout.querySelector(":scope > .ce-rehab-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-rehab-root";
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
		document.querySelectorAll(".ce-rehab-root").forEach(n => n.remove());
		stopModalObserver();
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-rehab-active")) dismissPicker();
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
			<div class="ce-hero ce-hero-rehab">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Rehabilitation Dashboard"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn btn-light ce-hero-btn" data-action="new-session">
								<span class="ce-ic">💪</span> ${esc(t("Therapy Session"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-plan">
								<span class="ce-ic">📋</span> ${esc(t("Therapy Plan"))}
							</button>
							<button class="btn btn-light ce-hero-btn" data-action="new-assessment">
								<span class="ce-ic">📝</span> ${esc(t("Assessment"))}
							</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Rehabilitation snapshot"))}</div>
					<div class="ds-grid" id="ce-rehab-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-rehab-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Active therapy plans"))}</div>
								<a class="ce-panel-link" href="/app/therapy-plan">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-rehab-plans-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent sessions"))}</div>
								<a class="ce-panel-link" href="/app/therapy-session">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-rehab-sessions-list">
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
		loadPlans(root);
		loadSessions(root);
	}

	function bindActions(root) {
		root.querySelector('[data-action="new-session"]')   .addEventListener("click", () => frappe.new_doc("Therapy Session"));
		root.querySelector('[data-action="new-plan"]')      .addEventListener("click", () => frappe.new_doc("Therapy Plan"));
		root.querySelector('[data-action="new-assessment"]').addEventListener("click", () => frappe.new_doc("Patient Assessment"));
	}

	function renderStats(root) {
		const stats = [
			{ key: "active_plans",     label: t("Active therapy plans"), doctype: "Therapy Plan",       filters: { docstatus: 1 },         icon: "📋", tone: "indigo", href: "/app/therapy-plan" },
			{ key: "submitted_sessions", label: t("Submitted sessions"), doctype: "Therapy Session",    filters: { docstatus: 1 },         icon: "💪", tone: "violet", href: "/app/therapy-session" },
			{ key: "draft_sessions",   label: t("Draft sessions"),       doctype: "Therapy Session",    filters: { docstatus: 0 },         icon: "📝", tone: "teal",   href: "/app/therapy-session" },
			{ key: "assessments",      label: t("Patient assessments"),  doctype: "Patient Assessment", filters: { docstatus: ["<", 2] },  icon: "🩹", tone: "amber",  href: "/app/patient-assessment" },
		];
		const wrap = root.querySelector("#ce-rehab-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-rehab-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then(c => {
					const el = root.querySelector(`#ce-rehab-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-rehab-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	function renderQuickActions(root) {
		const actions = [
			{ label: t("Therapy Session"),    icon: "💪", tone: "violet", href: "/app/therapy-session" },
			{ label: t("Therapy Plan"),       icon: "📋", tone: "indigo", href: "/app/therapy-plan" },
			{ label: t("Patient Assessment"), icon: "📝", tone: "amber",  href: "/app/patient-assessment" },
			{ label: t("Patient Encounter"),  icon: "🩺", tone: "indigo", href: "/app/patient-encounter" },
			{ label: t("Vital Signs"),        icon: "❤️", tone: "rose",   href: "/app/vital-signs" },
			{ label: t("Clinical Note"),      icon: "📄", tone: "slate",  href: "/app/clinical-note" },
			{ label: t("Service Request"),    icon: "📂", tone: "teal",   href: "/app/service-request" },
			{ label: t("Medication Request"), icon: "💊", tone: "rose",   href: "/app/medication-request" },
		];
		const wrap = root.querySelector("#ce-rehab-quick");
		// 8 cards at ds-col-3 = 4 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadPlans(root) {
		frappe.db.get_list("Therapy Plan", {
			filters: { docstatus: ["<", 2] },
			fields:  ["name", "patient", "start_date"],
			order_by: "start_date desc, creation desc",
			limit: 8,
		}).then(rows => {
			const body = root.querySelector("#ce-rehab-plans-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No therapy plans yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/therapy-plan/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">📋</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(t("Start"))} ${esc(fmtDate(r.start_date))}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadPlans failed", err);
			const body = root.querySelector("#ce-rehab-plans-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load therapy plans"))}</div>`;
		});
	}

	function loadSessions(root) {
		frappe.db.get_list("Therapy Session", {
			filters: { docstatus: ["<", 2] },
			fields:  ["name", "patient", "therapy_type"],
			order_by: "creation desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-rehab-sessions-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No sessions yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/therapy-session/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">💪</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.patient || r.name)}</div>
						<div class="ce-list-sub">${esc(r.therapy_type || "")}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadSessions failed", err);
			const body = root.querySelector("#ce-rehab-sessions-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load sessions"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isRehabPath();
		if (want && !mounted) { mount(); }
		else if (!want && mounted) { unmount(); }
		else if (want && mounted) { setBodyFlag(true); dismissPicker(); }
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isRehabPath() && !document.querySelector(".ce-rehab-root")) { mount(); }
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isRehabPath();
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
			if (isRehabPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
