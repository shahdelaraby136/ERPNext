/* Custom ERP — Apps-screen click bypass
   When a user clicks an app card on /apps, Frappe shows a picker overlay
   listing the app's child workspaces. For apps that have a custom hub
   dashboard (built by *_dashboard.js / *_hub.js files), we intercept the
   click so the user lands directly on the hub.

   Add a new entry to APP_DIRECT_NAV when you build a new hub.
*/

(function () {
	"use strict";

	const TAG = "[ce-redirects]";
	const log  = function () { try { console.log .apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {} };
	const warn = function () { try { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {} };

	log("script loaded");

	const APP_DIRECT_NAV = {
		"accounting": "/app/accounting",
		"invoicing":  "/app/invoicing",
		"assets":     "/app/assets",
		"buying":     "/app/buying",
		"projects":   "/app/projects",
		"quality":    "/app/quality",
		"stock":      "/app/stock",
		"subcontracting": "/app/subcontracting",
		"manufacturing":  "/app/manufacturing",
		"financial reports": "/app/financial-reports",
		"payroll":    "/app/payroll",
		"leaves":     "/app/leaves",
		"recruitment": "/app/recruitment",
		"shift & attendance": "/app/shift-%26-attendance",
		"performance": "/app/performance",
		"tax & benefits": "/app/tax-%26-benefits",
		"tenure": "/app/tenure",
		"expenses": "/app/expenses",
		"hr setup": "/app/hr-setup",
	};

	function navigateDirect(target) {
		log("→ navigating direct to", target);
		// Always use a full-page load. SPA navigation (frappe.set_route) leaves
		// the previous workspace's sidebar in place and races the hub render.
		try { window.location.replace(target); }
		catch (e) { window.location.href = target; }
	}

	function isOurDashboard(el) {
		return !!(el && el.closest && el.closest(".ce-acc-root, .ce-inv-root, .ce-sell-root, .ce-asset-root, .ce-buy-root, .ce-proj-root, .ce-qual-root, .ce-stock-root, .ce-sub-root, .ce-mfg-root, .ce-fin-root, .ce-payroll-root, .ce-leaves-root, .ce-recr-root, .ce-shift-root, .ce-perf-root, .ce-tax-root, .ce-tenure-root, .ce-exp-root, .ce-hrsetup-root"));
	}

	// --- Strategy 1: capture-phase click & mousedown on the document ---
	function handleAppClick(e) {
		let el = e.target, depth = 0;
		while (el && el !== document.body && depth < 10) {
			const txt = (el.textContent || "").trim();
			if (txt && txt.length < 30) {
				const target = APP_DIRECT_NAV[txt.toLowerCase()];
				if (target) {
					if (isOurDashboard(el)) return; // never hijack our own UI
					log("click intercept (event:", e.type, ") matched", txt, "depth", depth);
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();
					navigateDirect(target);
					return false;
				}
			}
			el = el.parentElement;
			depth++;
		}
	}
	document.addEventListener("click",     handleAppClick, true);
	document.addEventListener("mousedown", handleAppClick, true);

	// --- Strategy 2: intercept Frappe SPA route changes ---
	function watchRouter() {
		if (!(window.frappe && frappe.router && typeof frappe.router.on === "function")) return false;
		frappe.router.on("change", function () {
			const r = frappe.get_route() || [];
			const head = (r[0] || "").toString().toLowerCase();
			const target = APP_DIRECT_NAV[head];
			if (target && head !== target.replace(/^\/app\//, "")) {
				log("router change to", head, "→ rerouting", target);
				navigateDirect(target);
			}
		});
		return true;
	}
	let rNum = 0;
	const routerIv = setInterval(function () {
		rNum++;
		if (watchRouter() || rNum > 50) clearInterval(routerIv);
	}, 100);

	// --- Strategy 3: MutationObserver — catch the picker overlay if it slips
	// through and bypass it. Targets visible modals/overlays whose title text
	// matches an app we redirect.
	function pickerSweep() {
		const headings = document.querySelectorAll(".modal-title, .modal-header, h1, h2, h3, header, [class*='title']");
		for (const h of headings) {
			if (isOurDashboard(h)) continue;
			const text = (h.textContent || "").trim().toLowerCase();
			const target = APP_DIRECT_NAV[text];
			if (!target) continue;
			const popup = h.closest(".modal, [class*='picker'], [class*='overlay'], [class*='popup'], [role='dialog']");
			if (!popup || popup.offsetParent === null) continue;
			log("picker overlay caught for", text, "popup:", popup.className);
			try { if (window.$ && $(popup).modal) $(popup).modal("hide"); } catch (e) {}
			popup.style.display = "none";
			document.body.classList.remove("modal-open");
			document.querySelectorAll(".modal-backdrop").forEach(function (b) { b.remove(); });
			navigateDirect(target);
			return;
		}
	}
	new MutationObserver(pickerSweep).observe(document.body, {
		childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"],
	});
	window.addEventListener("load", function () { setTimeout(pickerSweep, 300); });
})();
