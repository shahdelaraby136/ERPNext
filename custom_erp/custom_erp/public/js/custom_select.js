/* Custom Select Dropdown
   Replaces native <select> dropdowns inside Frappe form Select fields
   with a styled menu that opens below the trigger with a smooth animation.
   The native <select> stays in the DOM (hidden) so Frappe controllers,
   change events, and form save continue to work unchanged. */
(function () {
  "use strict";

  var DATA_FLAG = "ceSelectEnhanced";
  var OPEN_CLASS = "ce-select-menu--open";

  function shouldEnhance(select) {
    if (!select || select.tagName !== "SELECT") return false;
    if (select.multiple) return false;
    if (select.dataset[DATA_FLAG]) return false;
    if (!select.classList.contains("form-control")) return false;
    /* Only enhance Select fields on forms / dialogs, not list filters
       or report tool selects (those live in tight chips). */
    if (!select.closest('.frappe-control[data-fieldtype="Select"]')) return false;
    return true;
  }

  function getOptionLabel(opt) {
    if (!opt) return "";
    return (opt.textContent || opt.value || "").trim();
  }

  function enhance(select) {
    select.dataset[DATA_FLAG] = "1";

    var wrapper = document.createElement("div");
    wrapper.className = "ce-select-wrapper";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ce-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML =
      '<span class="ce-select-label"></span>' +
      '<svg class="ce-select-arrow" viewBox="0 0 12 12" aria-hidden="true">' +
      '<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";
    wrapper.appendChild(trigger);

    var labelEl = trigger.querySelector(".ce-select-label");

    function syncLabel() {
      var opt = select.options[select.selectedIndex];
      var text = getOptionLabel(opt);
      if (text) {
        labelEl.textContent = text;
        labelEl.classList.remove("ce-select-label--placeholder");
      } else {
        labelEl.textContent = select.getAttribute("placeholder") || "";
        labelEl.classList.add("ce-select-label--placeholder");
      }
      if (select.disabled || select.readOnly) {
        trigger.setAttribute("disabled", "disabled");
      } else {
        trigger.removeAttribute("disabled");
      }
    }
    syncLabel();

    /* Watch native select for programmatic changes (form refresh, fetch_from). */
    var attrObs = new MutationObserver(syncLabel);
    attrObs.observe(select, {
      attributes: true,
      attributeFilter: ["value", "disabled", "readonly"],
      childList: true,
      subtree: true,
    });
    select.addEventListener("change", syncLabel);

    /* Block the native dropdown on every interaction path. */
    select.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
      trigger.focus();
    });
    select.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
    });

    var menu = null;
    var isOpen = false;

    function buildMenu() {
      var m = document.createElement("div");
      m.className = "ce-select-menu";
      m.setAttribute("role", "listbox");

      var hasEmptyOption = Array.from(select.options).some(function (o) {
        return !getOptionLabel(o);
      });
      if (hasEmptyOption && select.value) {
        var clearLabel = (typeof window.__ === "function") ? window.__("Clear") : "Clear";
        var clearItem = document.createElement("div");
        clearItem.className = "ce-select-option ce-select-option--clear";
        clearItem.setAttribute("role", "option");
        clearItem.textContent = clearLabel;
        clearItem.addEventListener("mousedown", function (e) {
          e.preventDefault();
          select.value = "";
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncLabel();
          closeMenu();
        });
        m.appendChild(clearItem);
      }

      Array.from(select.options).forEach(function (opt, i) {
        var item = document.createElement("div");
        item.className = "ce-select-option";
        item.setAttribute("role", "option");
        var text = getOptionLabel(opt);
        if (!text) return;
        if (i === select.selectedIndex) item.classList.add("ce-select-option--selected");
        item.textContent = text;
        item.dataset.value = opt.value;
        item.addEventListener("mousedown", function (e) {
          /* mousedown so we beat the document click that closes the menu */
          e.preventDefault();
          select.value = opt.value;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncLabel();
          closeMenu();
        });
        m.appendChild(item);
      });
      return m;
    }

    function position() {
      if (!menu) return;
      var rect = trigger.getBoundingClientRect();
      var menuH = menu.offsetHeight;
      var spaceBelow = window.innerHeight - rect.bottom;
      var openUp = spaceBelow < menuH + 16 && rect.top > menuH + 16;
      menu.style.left = rect.left + "px";
      menu.style.minWidth = rect.width + "px";
      menu.style.maxWidth = Math.max(rect.width, 320) + "px";
      if (openUp) {
        menu.style.top = (rect.top - menuH - 6) + "px";
        menu.classList.add("ce-select-menu--up");
      } else {
        menu.style.top = (rect.bottom + 6) + "px";
        menu.classList.remove("ce-select-menu--up");
      }
    }

    function onDocPointer(e) {
      if (!menu) return;
      if (menu.contains(e.target)) return;
      if (trigger.contains(e.target)) return;
      closeMenu();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        closeMenu();
        trigger.focus();
      }
    }
    function onScrollOrResize() {
      /* Reposition instead of closing so scrolling doesn't kill the menu. */
      position();
    }

    function openMenu() {
      if (isOpen) return;
      if (trigger.hasAttribute("disabled")) return;
      menu = buildMenu();
      document.body.appendChild(menu);
      position();
      /* Defer adding the open class so the transition runs from the initial state. */
      requestAnimationFrame(function () {
        if (menu) menu.classList.add(OPEN_CLASS);
      });
      isOpen = true;
      trigger.setAttribute("aria-expanded", "true");
      setTimeout(function () {
        document.addEventListener("mousedown", onDocPointer, true);
        document.addEventListener("keydown", onKey, true);
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
      }, 0);
    }

    function closeMenu() {
      if (!isOpen || !menu) return;
      var m = menu;
      m.classList.remove(OPEN_CLASS);
      menu = null;
      isOpen = false;
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", onDocPointer, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      setTimeout(function () { if (m && m.parentNode) m.parentNode.removeChild(m); }, 200);
    }

    function toggleMenu() {
      if (isOpen) closeMenu();
      else openMenu();
    }

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });
    trigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
    });
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("select.form-control").forEach(function (s) {
      if (shouldEnhance(s)) enhance(s);
    });
  }

  function init() {
    scan(document);
    var rootObs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches("select.form-control")) {
            if (shouldEnhance(n)) enhance(n);
          } else if (n.querySelectorAll) {
            scan(n);
          }
        }
      }
    });
    rootObs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
