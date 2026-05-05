/* Custom ERP — Setup Hub (Healthcare Setup)
   Hijacks /app/setup and renders a "Healthcare Setup" dashboard in place.
*/

(function () {
	"use strict";

	const TAG = "[ce-setup]";
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

	// Layout / hero / hide-rules live in setup_dashboard.css

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
	function isSetupPath() {
		try {
			if (window.frappe && frappe.get_route) {
				const r = frappe.get_route() || [];
				for (let i = 0; i < Math.min(r.length, 3); i++) {
					const seg = (r[i] || "").toString().toLowerCase();
					if (seg === "setup") return true;
				}
			}
		} catch (e) {}
		const p = (window.location.pathname || "").toLowerCase();
		const matches = ["/app/setup", "/desk/setup"];
		for (const m of matches) {
			if (p === m || p.startsWith(m + "/") || p.startsWith(m + "?")) return true;
		}
		return false;
	}

	// ---------- mount / unmount ----------
	let mounted = false;
	let observer = null;
	let modalObserver = null;

	function setBodyFlag(on) { document.body.classList.toggle("ce-setup-active", !!on); }

	function mount() {
		const layout = document.querySelector(".layout-main-section");
		if (!layout) { return false; }

		let root = layout.querySelector(":scope > .ce-setup-root");
		if (!root) {
			root = document.createElement("div");
			root.className = "ce-setup-root";
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
		document.querySelectorAll(".ce-setup-root").forEach(n => n.remove());
		stopModalObserver();
	}

	function startModalObserver() {
		if (modalObserver) return;
		modalObserver = new MutationObserver(() => {
			if (document.body.classList.contains("ce-setup-active")) dismissPicker();
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
			<div class="ce-hero ce-hero-setup">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(t("Marley Health"))}</div>
							<h1 class="ce-hero-title">${esc(t("Healthcare Setup"))}</h1>
							<div class="ce-hero-sub">${esc(todayPretty)}</div>
						</div>
						<div class="ce-hero-actions">
							<a class="btn btn-light ce-hero-btn" href="/app/healthcare-settings">
								<span class="ce-ic">⚙️</span> ${esc(t("Healthcare Settings"))}
							</a>
							<a class="btn btn-light ce-hero-btn" href="/app/patient-history-settings">
								<span class="ce-ic">📋</span> ${esc(t("Patient History"))}
							</a>
							<a class="btn btn-light ce-hero-btn" href="/app/healthcare-practitioner">
								<span class="ce-ic">🩺</span> ${esc(t("Practitioners"))}
							</a>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Setup snapshot"))}</div>
					<div class="ds-grid" id="ce-setup-stats"></div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(t("Modules"))}</div>
					<div class="ds-grid" id="ce-setup-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Recent service templates"))}</div>
								<a class="ce-panel-link" href="/app/treatment-plan-template">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-setup-tpl-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-4 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(t("Service units"))}</div>
								<a class="ce-panel-link" href="/app/healthcare-service-unit">${esc(t("View all"))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-setup-units-list">
								<div class="ce-skeleton"></div>
								<div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		renderStats(root);
		renderQuickActions(root);
		loadTemplates(root);
		loadUnits(root);
	}

	function renderStats(root) {
		const stats = [
			{ key: "tpl_treatment", label: t("Treatment Plan Templates"), doctype: "Treatment Plan Template", icon: "📋", tone: "indigo", href: "/app/treatment-plan-template" },
			{ key: "tpl_therapy",   label: t("Therapy Types"),             doctype: "Therapy Type",            icon: "💪", tone: "violet", href: "/app/therapy-type" },
			{ key: "tpl_lab",       label: t("Lab Test Templates"),        doctype: "Lab Test Template",       icon: "🧪", tone: "teal",   href: "/app/lab-test-template" },
			{ key: "service_units", label: t("Service Units"),             doctype: "Healthcare Service Unit", icon: "🏥", tone: "amber",  href: "/app/healthcare-service-unit" },
		];
		const wrap = root.querySelector("#ce-setup-stats");
		stats.forEach(s => {
			wrap.insertAdjacentHTML("beforeend", `
				<a class="ds-col-3 ce-stat ce-stat-${s.tone}" href="${esc(s.href)}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${esc(s.label)}</div>
						<div class="ce-stat-value" id="ce-setup-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype)
				.then(c => {
					const el = root.querySelector(`#ce-setup-${s.key}`);
					if (el) el.textContent = Number(c || 0).toLocaleString();
				})
				.catch(() => {
					const el = root.querySelector(`#ce-setup-${s.key}`);
					if (el) el.textContent = "—";
				});
		});
	}

	// 8 doctype cards covering the most-used setup areas
	function renderQuickActions(root) {
		const actions = [
			{ label: t("Healthcare Settings"),     icon: "⚙️", tone: "slate",  href: "/app/healthcare-settings" },
			{ label: t("Patient History Settings"), icon: "📋", tone: "indigo", href: "/app/patient-history-settings" },
			{ label: t("Treatment Plan Template"), icon: "📄", tone: "indigo", href: "/app/treatment-plan-template" },
			{ label: t("Therapy Plan Template"),   icon: "📑", tone: "violet", href: "/app/therapy-plan-template" },
			{ label: t("Lab Test Template"),       icon: "🧪", tone: "teal",   href: "/app/lab-test-template" },
			{ label: t("Medication"),              icon: "💊", tone: "rose",   href: "/app/medication" },
			{ label: t("Medical Department"),      icon: "🏥", tone: "amber",  href: "/app/medical-department" },
			{ label: t("Service Unit"),            icon: "🛏️", tone: "green",  href: "/app/healthcare-service-unit" },
		];
		const wrap = root.querySelector("#ce-setup-quick");
		// 8 cards at ds-col-3 = 4 per row × 2 rows.
		wrap.innerHTML = actions.map(a => `
			<a class="ds-col-3 ce-quick ce-quick-${a.tone}" href="${esc(a.href)}">
				<div class="ce-quick-icon">${a.icon}</div>
				<div class="ce-quick-label">${esc(a.label)}</div>
			</a>
		`).join("");
	}

	function loadTemplates(root) {
		frappe.db.get_list("Treatment Plan Template", {
			fields:  ["name"],
			order_by: "creation desc",
			limit: 8,
		}).then(rows => {
			const body = root.querySelector("#ce-setup-tpl-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No treatment plan templates yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/treatment-plan-template/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">📄</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.name)}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadTemplates failed", err);
			const body = root.querySelector("#ce-setup-tpl-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load templates"))}</div>`;
		});
	}

	function loadUnits(root) {
		frappe.db.get_list("Healthcare Service Unit", {
			fields:  ["name"],
			order_by: "creation desc",
			limit: 6,
		}).then(rows => {
			const body = root.querySelector("#ce-setup-units-list");
			if (!body) return;
			if (!rows.length) { body.innerHTML = `<div class="ce-empty">${esc(t("No service units yet"))}</div>`; return; }
			body.innerHTML = rows.map(r => `
				<a class="ce-list-row" href="/app/healthcare-service-unit/${encodeURIComponent(r.name)}">
					<div class="ce-list-badge">🏥</div>
					<div class="ce-list-main">
						<div class="ce-list-title">${esc(r.name)}</div>
					</div>
				</a>
			`).join("");
		}).catch(err => {
			warn("loadUnits failed", err);
			const body = root.querySelector("#ce-setup-units-list");
			if (body) body.innerHTML = `<div class="ce-empty">${esc(t("Unable to load units"))}</div>`;
		});
	}

	// ---------- orchestration ----------
	function tick() {
		const want = isSetupPath();
		if (want && !mounted) { mount(); }
		else if (!want && mounted) { unmount(); }
		else if (want && mounted) { setBodyFlag(true); dismissPicker(); }
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isSetupPath() && !document.querySelector(".ce-setup-root")) { mount(); }
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === "function") {
			frappe.router.on("change", () => {
				const want = isSetupPath();
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
			if (isSetupPath()) tick();
		}, 200);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
