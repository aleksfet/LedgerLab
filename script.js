/* ============================================================
   LedgerLab — script.js
   Starter interactions only.
   No calculators or accounting logic yet — that comes later.
   For now: smooth in-page scrolling to placeholder sections
   and a small active-nav highlight.
   ============================================================ */

(function () {
  "use strict";

  /**
   * Smoothly scroll to a target section by its element id.
   * Falls back gracefully if the target doesn't exist.
   * @param {string} hash - e.g. "#simulator"
   */
  function scrollToHash(hash) {
    if (!hash || hash === "#") return;
    var target = document.querySelector(hash);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Wire up any in-page anchor link (href starting with "#")
   * so the two main buttons and nav links scroll to their
   * placeholder sections.
   */
  function initSmoothScroll() {
    var links = document.querySelectorAll('a[href^="#"]');
    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var hash = link.getAttribute("href");
        if (!hash || hash === "#") return;

        var target = document.querySelector(hash);
        if (!target) return; // let the browser handle unknown anchors

        event.preventDefault();
        scrollToHash(hash);

        // Update the URL without an extra jump, for shareable links.
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", hash);
        }
      });
    });
  }

  /**
   * Highlight the current section in the nav as the user scrolls.
   * Purely cosmetic; safe to remove later.
   */
  function initActiveNav() {
    var sections = document.querySelectorAll("main section[id]");
    var navLinks = document.querySelectorAll(".nav-links a");
    if (!sections.length || !navLinks.length) return;
    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.getAttribute("id");
          navLinks.forEach(function (link) {
            var isActive = link.getAttribute("href") === "#" + id;
            link.classList.toggle("is-active", isActive);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ==========================================================
     Business Simulator (MVP)
     Simple, beginner-friendly budget math with clear labels.
     ========================================================== */

  /** Read a numeric input by id; blank / invalid becomes 0, negatives clamp to 0. */
  function readMoney(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var value = parseFloat(el.value);
    if (isNaN(value) || value < 0) return 0;
    return value;
  }

  /** Format a number as USD currency, e.g. 1234.5 -> "$1,234.50". */
  function formatMoney(amount) {
    var sign = amount < 0 ? "-" : "";
    var abs = Math.abs(amount);
    return (
      sign +
      "$" +
      abs.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  /**
   * Core calculation. Kept deliberately simple for beginners:
   * - Monthly expenses are the recurring operating costs.
   * - Equipment and inventory are one-time purchases that reduce cash now
   *   (and are intentionally NOT counted as monthly expenses here).
   * - Profit/loss = revenue - monthly expenses.
   * - Cash remaining = starting cash - startup purchases + monthly profit/loss.
   */
  function calculateSimulation() {
    var inputs = {
      name: (document.getElementById("biz-name") || {}).value || "",
      startingCash: readMoney("starting-cash"),
      revenue: readMoney("monthly-revenue"),
      rent: readMoney("rent"),
      wages: readMoney("wages"),
      supplies: readMoney("supplies"),
      utilities: readMoney("utilities"),
      other: readMoney("other"),
      equipment: readMoney("equipment"),
      inventory: readMoney("inventory"),
    };

    var totalExpenses =
      inputs.rent +
      inputs.wages +
      inputs.supplies +
      inputs.utilities +
      inputs.other;

    var startupPurchases = inputs.equipment + inputs.inventory;
    var profit = inputs.revenue - totalExpenses;
    var cashRemaining = inputs.startingCash - startupPurchases + profit;

    return {
      inputs: inputs,
      totalExpenses: totalExpenses,
      startupPurchases: startupPurchases,
      profit: profit,
      cashRemaining: cashRemaining,
    };
  }

  /** Build the expense-breakdown rows (label, amount, % of total expenses). */
  function renderBreakdown(result) {
    var list = document.getElementById("breakdown-list");
    if (!list) return;
    list.innerHTML = "";

    var items = [
      { label: "Rent", value: result.inputs.rent },
      { label: "Wages", value: result.inputs.wages },
      { label: "Supplies", value: result.inputs.supplies },
      { label: "Utilities", value: result.inputs.utilities },
      { label: "Other", value: result.inputs.other },
    ];

    var total = result.totalExpenses;

    items.forEach(function (item) {
      var pct = total > 0 ? (item.value / total) * 100 : 0;

      var li = document.createElement("li");
      li.className = "breakdown-row";

      var head = document.createElement("div");
      head.className = "breakdown-head";

      var label = document.createElement("span");
      label.className = "breakdown-label";
      label.textContent = item.label;

      var amount = document.createElement("span");
      amount.className = "breakdown-amount";
      amount.textContent =
        formatMoney(item.value) + "  (" + pct.toFixed(0) + "%)";

      head.appendChild(label);
      head.appendChild(amount);

      var bar = document.createElement("div");
      bar.className = "breakdown-bar";
      var fill = document.createElement("div");
      fill.className = "breakdown-fill";
      fill.style.width = pct.toFixed(1) + "%";
      bar.appendChild(fill);

      li.appendChild(head);
      li.appendChild(bar);
      list.appendChild(li);
    });
  }

  /** Choose a business-health state from profit and remaining cash. */
  function getHealth(result) {
    if (result.cashRemaining < 0) {
      return {
        state: "danger",
        message:
          "Warning: your cash runs negative. Startup purchases and expenses are " +
          "more than your business can cover right now.",
      };
    }
    if (result.profit > 0) {
      return {
        state: "good",
        message:
          "Your business is profitable this month because revenue is higher " +
          "than expenses.",
      };
    }
    if (result.profit < 0) {
      return {
        state: "warn",
        message:
          "Your business is losing money this month because expenses are higher " +
          "than revenue.",
      };
    }
    return {
      state: "neutral",
      message:
        "Your business is breaking even this month — revenue and expenses are " +
        "exactly equal.",
    };
  }

  /** Build the plain-English explanation bullet points. */
  function renderExplanation(result) {
    var list = document.getElementById("explanation-list");
    if (!list) return;
    list.innerHTML = "";

    var notes = [];

    if (result.profit > 0) {
      notes.push(
        "You made a profit of " +
          formatMoney(result.profit) +
          " this month because revenue (" +
          formatMoney(result.inputs.revenue) +
          ") was higher than your monthly expenses (" +
          formatMoney(result.totalExpenses) +
          ")."
      );
    } else if (result.profit < 0) {
      notes.push(
        "You had a loss of " +
          formatMoney(Math.abs(result.profit)) +
          " this month because your monthly expenses (" +
          formatMoney(result.totalExpenses) +
          ") were higher than revenue (" +
          formatMoney(result.inputs.revenue) +
          ")."
      );
    } else {
      notes.push(
        "You broke even — revenue and monthly expenses were both " +
          formatMoney(result.inputs.revenue) +
          "."
      );
    }

    if (result.startupPurchases > 0) {
      notes.push(
        "Equipment and inventory (" +
          formatMoney(result.startupPurchases) +
          ") reduce your cash, even if they may not all count as expenses " +
          "immediately in accounting. That's why your cash can drop even in a " +
          "profitable month."
      );
    }

    if (result.cashRemaining < 0) {
      notes.push(
        "Your cash remaining is negative (" +
          formatMoney(result.cashRemaining) +
          "). You'd need more starting cash, higher revenue, or lower spending " +
          "to stay afloat."
      );
    } else {
      notes.push(
        "After startup purchases and this month's results, you have " +
          formatMoney(result.cashRemaining) +
          " in cash remaining."
      );
    }

    notes.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }

  /** Push all computed values into the dashboard UI. */
  function renderResults(result) {
    var empty = document.getElementById("sim-empty");
    var dashboard = document.getElementById("sim-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var name = result.inputs.name.trim();
    var title = document.getElementById("dash-title");
    if (title) {
      title.textContent = name ? name + " — Monthly Snapshot" : "Monthly Snapshot";
    }

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("out-expenses", formatMoney(result.totalExpenses));
    setText("out-profit", formatMoney(result.profit));
    setText("out-cash", formatMoney(result.cashRemaining));
    setText("out-revenue", formatMoney(result.inputs.revenue));

    // Color the profit and cash cards by sign.
    var profitCard = document.getElementById("out-profit-card");
    if (profitCard) {
      profitCard.classList.remove("is-positive", "is-negative");
      if (result.profit > 0) profitCard.classList.add("is-positive");
      else if (result.profit < 0) profitCard.classList.add("is-negative");
    }
    var cashCard = document.getElementById("out-cash-card");
    if (cashCard) {
      cashCard.classList.remove("is-positive", "is-negative");
      if (result.cashRemaining < 0) cashCard.classList.add("is-negative");
      else cashCard.classList.add("is-positive");
    }

    // Health banner
    var health = getHealth(result);
    var banner = document.getElementById("health-banner");
    if (banner) {
      banner.classList.remove(
        "health-good",
        "health-warn",
        "health-danger",
        "health-neutral"
      );
      banner.classList.add("health-" + health.state);
    }
    setText("health-message", health.message);

    renderBreakdown(result);
    renderExplanation(result);
  }

  /**
   * Restrict money fields to numbers only.
   * type="number" by itself still lets users type "e", "E", "+", and "-"
   * (scientific notation / sign chars), which is why letters slipped through.
   * We block those keys and sanitize pasted/typed input to digits + one dot.
   */
  function initMoneyInputs() {
    var inputs = document.querySelectorAll(".money-input input");
    var blockedKeys = ["e", "E", "+", "-"];

    inputs.forEach(function (input) {
      input.addEventListener("keydown", function (event) {
        if (blockedKeys.indexOf(event.key) !== -1) {
          event.preventDefault();
        }
      });

      // Catch pasted content and any browser that still admits stray chars.
      input.addEventListener("input", function () {
        var cleaned = input.value.replace(/[^0-9.]/g, "");
        // Keep only the first decimal point.
        var firstDot = cleaned.indexOf(".");
        if (firstDot !== -1) {
          cleaned =
            cleaned.slice(0, firstDot + 1) +
            cleaned.slice(firstDot + 1).replace(/\./g, "");
        }
        if (cleaned !== input.value) input.value = cleaned;
      });
    });
  }

  /* ==========================================================
     Form validation
     Every field is required. Money fields must be valid,
     non-negative numbers. Errors show as a red message + red
     border on the offending field; valid input clears them.
     ========================================================== */

  // type: "text" (business name) or "money" (numeric, >= 0).
  var REQUIRED_FIELDS = [
    { id: "biz-name", type: "text" },
    { id: "starting-cash", type: "money" },
    { id: "monthly-revenue", type: "money" },
    { id: "rent", type: "money" },
    { id: "wages", type: "money" },
    { id: "supplies", type: "money" },
    { id: "utilities", type: "money" },
    { id: "other", type: "money" },
    { id: "equipment", type: "money" },
    { id: "inventory", type: "money" },
  ];

  /** The .field wrapper that owns a given input. */
  function getFieldWrapper(input) {
    return input.closest ? input.closest(".field") : null;
  }

  /** Find (or lazily create) the error message element for a field wrapper. */
  function getErrorEl(wrapper) {
    var el = wrapper.querySelector(".field-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "field-error";
      el.setAttribute("role", "alert");
      wrapper.appendChild(el);
    }
    return el;
  }

  function showError(input, message) {
    var wrapper = getFieldWrapper(input);
    if (!wrapper) return;
    wrapper.classList.add("has-error");
    getErrorEl(wrapper).textContent = message;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError(input) {
    var wrapper = getFieldWrapper(input);
    if (!wrapper) return;
    wrapper.classList.remove("has-error");
    var el = wrapper.querySelector(".field-error");
    if (el) el.textContent = "";
    input.removeAttribute("aria-invalid");
  }

  /** Validate one field. Returns true if valid; otherwise shows an error. */
  function validateField(field) {
    var input = document.getElementById(field.id);
    if (!input) return true;
    var raw = (input.value || "").trim();

    if (field.type === "text") {
      if (raw === "") {
        showError(input, "Business name is required.");
        return false;
      }
      clearError(input);
      return true;
    }

    // Money field: must be present and a valid, non-negative number.
    if (raw === "") {
      showError(input, "Please enter a valid number.");
      return false;
    }
    var value = Number(raw);
    if (isNaN(value) || !isFinite(value)) {
      showError(input, "Please enter a valid number.");
      return false;
    }
    if (value < 0) {
      showError(input, "Please enter a number of 0 or more.");
      return false;
    }
    clearError(input);
    return true;
  }

  /** Validate the whole form. Focuses the first invalid field. */
  function validateAll() {
    var firstInvalid = null;
    REQUIRED_FIELDS.forEach(function (field) {
      var ok = validateField(field);
      if (!ok && !firstInvalid) {
        firstInvalid = document.getElementById(field.id);
      }
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  /** Clear all error states (used on reset). */
  function clearAllErrors() {
    REQUIRED_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (input) clearError(input);
    });
  }

  /** Re-validate a field as the user fixes it, but only once it's shown an error. */
  function initLiveValidation() {
    REQUIRED_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var wrapper = getFieldWrapper(input);
        if (wrapper && wrapper.classList.contains("has-error")) {
          validateField(field);
        }
      });
    });
  }

  function initSimulator() {
    var form = document.getElementById("sim-form");
    if (!form) return;

    initLiveValidation();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateAll()) return; // Stop: don't run on invalid/blank input.
      var result = calculateSimulation();
      renderResults(result);
    });

    form.addEventListener("reset", function () {
      clearAllErrors();
      var empty = document.getElementById("sim-empty");
      var dashboard = document.getElementById("sim-dashboard");
      if (dashboard) dashboard.hidden = true;
      if (empty) empty.hidden = false;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSmoothScroll();
    initActiveNav();
    initMoneyInputs();
    initSimulator();
  });
})();
