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

    // Yearly projection: assume this month repeats for 12 months.
    var yearlyRevenue = inputs.revenue * 12;
    var yearlyExpenses = totalExpenses * 12;
    var yearlyProfit = profit * 12;
    var yearEndCash = inputs.startingCash - startupPurchases + yearlyProfit;

    return {
      inputs: inputs,
      totalExpenses: totalExpenses,
      startupPurchases: startupPurchases,
      profit: profit,
      cashRemaining: cashRemaining,
      yearlyRevenue: yearlyRevenue,
      yearlyExpenses: yearlyExpenses,
      yearlyProfit: yearlyProfit,
      yearEndCash: yearEndCash,
    };
  }

  /** Build the expense-breakdown rows (label, amount, % of total expenses). */
  function renderBreakdown(result) {
    var list = document.getElementById("breakdown-list");
    if (!list) return;
    list.innerHTML = "";

    var total = result.totalExpenses;

    // Empty state: nothing to chart when there are no expenses.
    if (total <= 0) {
      var emptyRow = document.createElement("li");
      emptyRow.className = "breakdown-empty";
      emptyRow.textContent = "No monthly expenses entered yet.";
      list.appendChild(emptyRow);
      return;
    }

    var items = [
      { label: "Rent", value: result.inputs.rent },
      { label: "Wages", value: result.inputs.wages },
      { label: "Supplies", value: result.inputs.supplies },
      { label: "Utilities", value: result.inputs.utilities },
      { label: "Other", value: result.inputs.other },
    ];

    items.forEach(function (item) {
      var pct = (item.value / total) * 100;

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
        formatMoney(item.value) + " · " + pct.toFixed(0) + "%";

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

  /** Build the short plain-English explanation bullets (kept brief on purpose). */
  function renderExplanation(result) {
    var list = document.getElementById("explanation-list");
    if (!list) return;
    list.innerHTML = "";

    var notes = [];

    // 1) Revenue minus expenses creates profit or loss.
    if (result.profit > 0) {
      notes.push(
        "Revenue minus expenses creates profit or loss — here revenue is higher, so the business profits " +
          formatMoney(result.profit) +
          " this month."
      );
    } else if (result.profit < 0) {
      notes.push(
        "Revenue minus expenses creates profit or loss — here expenses are higher, so the business loses " +
          formatMoney(Math.abs(result.profit)) +
          " this month."
      );
    } else {
      notes.push(
        "Revenue minus expenses creates profit or loss — here they're equal, so the business breaks even this month."
      );
    }

    // 2) Cash at start of month + profit/loss − equipment & inventory = estimated ending cash.
    notes.push(
      "Cash at start of month plus this month's profit or loss, minus equipment and inventory purchases (" +
        formatMoney(result.startupPurchases) +
        "), gives an estimated ending cash balance of " +
        formatMoney(result.cashRemaining) +
        "."
    );

    // 3) Equipment & inventory reduce cash, even if accounting treats them differently.
    notes.push(
      "Equipment and inventory purchases reduce cash, even though accounting may treat them differently than normal monthly expenses."
    );

    notes.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }

  /** Yearly trend message + state, based on the projection. */
  function getYearlyTrend(result) {
    if (result.yearEndCash < 0) {
      return {
        state: "negative",
        message:
          "Cash may run negative this year unless the business increases revenue, " +
          "lowers expenses, or adds more starting cash.",
      };
    }
    if (result.yearlyProfit > 0) {
      return {
        state: "positive",
        message:
          "If these numbers continue, the business is projected to make a yearly profit of " +
          formatMoney(result.yearlyProfit) +
          ".",
      };
    }
    if (result.yearlyProfit < 0) {
      return {
        state: "negative",
        message:
          "If these numbers continue, the business is projected to lose money this year (" +
          formatMoney(result.yearlyProfit) +
          ").",
      };
    }
    return {
      state: "neutral",
      message:
        "If these numbers continue, the business is projected to break even this year.",
    };
  }

  /**
   * Business health status from profit and remaining cash.
   *  - At Risk:       cash remaining is negative
   *  - Stable:        profit is close to break-even, cash positive
   *  - Strong:        profit is positive (beyond the break-even band), cash positive
   *  - Watch Closely: profit is negative, but cash is still positive
   * "Close to break-even" = within 5% of revenue (or exactly $0 when revenue is 0).
   */
  function getStatus(result) {
    if (result.cashRemaining < 0) {
      return { key: "risk", label: "At Risk" };
    }
    var revenue = result.inputs.revenue;
    var band = revenue > 0 ? revenue * 0.05 : 0;
    if (Math.abs(result.profit) <= band) {
      return { key: "stable", label: "Stable" };
    }
    if (result.profit > 0) {
      return { key: "strong", label: "Strong" };
    }
    return { key: "watch", label: "Watch Closely" };
  }

  /** Profit margin as a percentage string; "N/A" when revenue is 0. */
  function formatMargin(result) {
    if (result.inputs.revenue <= 0) return "N/A";
    var margin = (result.profit / result.inputs.revenue) * 100;
    return margin.toFixed(1) + "%";
  }

  /** The single biggest monthly expense, or null when there are no expenses. */
  function getBiggestExpense(result) {
    if (result.totalExpenses <= 0) return null;
    var items = [
      { label: "Rent", value: result.inputs.rent },
      { label: "Wages", value: result.inputs.wages },
      { label: "Supplies", value: result.inputs.supplies },
      { label: "Utilities", value: result.inputs.utilities },
      { label: "Other", value: result.inputs.other },
    ];
    var biggest = items[0];
    items.forEach(function (item) {
      if (item.value > biggest.value) biggest = item;
    });
    return biggest;
  }

  /** Fill the Business Health insight cards (status, margin, biggest, break-even). */
  function renderInsights(result, status, biggest) {
    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Status card + color by state.
    setText("out-status", status.label);
    var statusCard = document.getElementById("out-status-card");
    if (statusCard) {
      statusCard.classList.remove(
        "status-strong",
        "status-stable",
        "status-watch",
        "status-risk"
      );
      statusCard.classList.add("status-" + status.key);
    }

    // Profit margin, colored by sign when revenue exists.
    setText("out-margin", formatMargin(result));
    var marginCard = document.getElementById("out-margin-card");
    if (marginCard) {
      marginCard.classList.remove("is-positive", "is-negative");
      if (result.inputs.revenue > 0) {
        marginCard.classList.add(result.profit >= 0 ? "is-positive" : "is-negative");
      }
    }

    // Biggest expense + break-even revenue (= total monthly expenses).
    setText("out-biggest", biggest ? biggest.label : "—");
    setText("out-breakeven", formatMoney(result.totalExpenses));
  }

  /** Build 2–3 short, plain-English improvement suggestions from the numbers. */
  function renderSuggestions(result, biggest) {
    var list = document.getElementById("suggestion-list");
    if (!list) return;
    list.innerHTML = "";

    var suggestions = [];

    // 1) Profitability vs. break-even (always present).
    if (result.profit > 0) {
      suggestions.push(
        "Revenue is above break-even, so the business is profitable this month."
      );
    } else if (result.profit < 0) {
      suggestions.push(
        "Profit is negative, so revenue must increase or expenses must decrease to break even."
      );
    } else {
      suggestions.push(
        "Revenue exactly meets break-even, so the business is right at the edge of profitability."
      );
    }

    // 2) Cash position.
    if (result.cashRemaining < 0) {
      suggestions.push(
        "Cash is negative, so the business may need more beginning cash or lower purchases."
      );
    } else if (result.profit > 0) {
      suggestions.push(
        "Profit and cash are both positive, leaving room to reinvest or build a cash reserve."
      );
    }

    // 3) Largest expense lever.
    if (biggest) {
      suggestions.push(
        "Your largest expense is " +
          biggest.label.toLowerCase() +
          ". Reviewing that cost could improve profit."
      );
    }

    suggestions.slice(0, 3).forEach(function (text) {
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
      title.textContent = name
        ? name + " — Monthly Assessment & Projection"
        : "Monthly Assessment & Projection";
    }

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Monthly snapshot
    setText("out-revenue", formatMoney(result.inputs.revenue));
    setText("out-expenses", formatMoney(result.totalExpenses));
    setText("out-profit", formatMoney(result.profit));
    setText("out-cash", formatMoney(result.cashRemaining));

    // Yearly projection
    setText("out-year-revenue", formatMoney(result.yearlyRevenue));
    setText("out-year-expenses", formatMoney(result.yearlyExpenses));
    setText("out-year-profit", formatMoney(result.yearlyProfit));
    setText("out-year-cash", formatMoney(result.yearEndCash));

    // Color cards by sign (positive green / negative red).
    var colorBySign = function (id, positive) {
      var card = document.getElementById(id);
      if (!card) return;
      card.classList.remove("is-positive", "is-negative");
      card.classList.add(positive ? "is-positive" : "is-negative");
    };
    colorBySign("out-profit-card", result.profit >= 0);
    colorBySign("out-cash-card", result.cashRemaining >= 0);
    colorBySign("out-year-profit-card", result.yearlyProfit >= 0);
    colorBySign("out-year-cash-card", result.yearEndCash >= 0);

    // Yearly trend message
    var trend = getYearlyTrend(result);
    var trendEl = document.getElementById("yearly-trend");
    if (trendEl) {
      trendEl.classList.remove("is-positive", "is-negative");
      if (trend.state === "positive") trendEl.classList.add("is-positive");
      else if (trend.state === "negative") trendEl.classList.add("is-negative");
      trendEl.textContent = trend.message;
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

    // Business health insights + suggestions
    var status = getStatus(result);
    var biggest = getBiggestExpense(result);
    renderInsights(result, status, biggest);

    renderBreakdown(result);
    renderExplanation(result);
    renderSuggestions(result, biggest);
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
