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
   * Compact currency for inline helper text: drops the cents on whole amounts
   * (2000 -> "$2,000") but keeps them when present (2000.5 -> "$2,000.50").
   */
  function formatMoneyCompact(amount) {
    var sign = amount < 0 ? "-" : "";
    var abs = Math.abs(amount);
    var hasCents = Math.round(abs * 100) % 100 !== 0;
    return (
      sign +
      "$" +
      abs.toLocaleString("en-US", {
        minimumFractionDigits: hasCents ? 2 : 0,
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

  /* ==========================================================
     Planning & Budgeting Mode
     A separate form + report. Budget a month forward, set a
     target profit, and see whether the plan reaches it.
     Assessment Mode is untouched by anything below.
     ========================================================== */

  // Same validation contract as Assessment: name required, money >= 0.
  var PLAN_REQUIRED_FIELDS = [
    { id: "plan-biz-name", type: "text" },
    { id: "plan-starting-cash", type: "money" },
    { id: "plan-target-profit", type: "money" },
    { id: "plan-revenue", type: "money" },
    { id: "plan-rent", type: "money" },
    { id: "plan-wages", type: "money" },
    { id: "plan-supplies", type: "money" },
    { id: "plan-utilities", type: "money" },
    { id: "plan-marketing", type: "money" },
    { id: "plan-other", type: "money" },
    { id: "plan-equipment", type: "money" },
    { id: "plan-inventory", type: "money" },
  ];

  /**
   * Planning math (separate from Assessment):
   *  - Planned expenses = rent + wages + supplies + utilities + marketing + other
   *  - Expected profit/loss = expected revenue − planned expenses
   *  - Target profit gap = target profit − expected profit  (> 0 means short)
   *  - Startup cash needed = equipment + inventory
   *  - Estimated cash left = cash to start − startup purchases + expected profit
   */
  function calculatePlan() {
    var inputs = {
      name: (document.getElementById("plan-biz-name") || {}).value || "",
      startingCash: readMoney("plan-starting-cash"),
      targetProfit: readMoney("plan-target-profit"),
      revenue: readMoney("plan-revenue"),
      rent: readMoney("plan-rent"),
      wages: readMoney("plan-wages"),
      supplies: readMoney("plan-supplies"),
      utilities: readMoney("plan-utilities"),
      marketing: readMoney("plan-marketing"),
      other: readMoney("plan-other"),
      equipment: readMoney("plan-equipment"),
      inventory: readMoney("plan-inventory"),
    };

    var totalExpenses =
      inputs.rent +
      inputs.wages +
      inputs.supplies +
      inputs.utilities +
      inputs.marketing +
      inputs.other;

    var expectedProfit = inputs.revenue - totalExpenses;
    var targetGap = inputs.targetProfit - expectedProfit;
    var startupPurchases = inputs.equipment + inputs.inventory;
    var cashLeft = inputs.startingCash - startupPurchases + expectedProfit;

    return {
      inputs: inputs,
      totalExpenses: totalExpenses,
      expectedProfit: expectedProfit,
      targetGap: targetGap,
      startupPurchases: startupPurchases,
      cashLeft: cashLeft,
    };
  }

  /** Largest budgeted category, or null when nothing is budgeted. */
  function getBiggestBudget(plan) {
    if (plan.totalExpenses <= 0) return null;
    var items = [
      { label: "Rent", value: plan.inputs.rent },
      { label: "Wages", value: plan.inputs.wages },
      { label: "Supplies", value: plan.inputs.supplies },
      { label: "Utilities", value: plan.inputs.utilities },
      { label: "Marketing", value: plan.inputs.marketing },
      { label: "Other", value: plan.inputs.other },
    ];
    var biggest = items[0];
    items.forEach(function (item) {
      if (item.value > biggest.value) biggest = item;
    });
    return biggest;
  }

  /** Overall read on the plan, shown in the banner. */
  function getPlanHealth(plan) {
    if (plan.cashLeft < 0) {
      return {
        state: "danger",
        message:
          "This startup plan runs cash negative after startup costs and one month of operations.",
      };
    }
    if (plan.expectedProfit < 0) {
      return {
        state: "warn",
        message:
          "This startup plan spends more than it earns — planned expenses are above expected revenue.",
      };
    }
    if (plan.targetGap <= 0) {
      return {
        state: "good",
        message: "This startup plan meets your target monthly profit.",
      };
    }
    return {
      state: "neutral",
      message:
        "This startup plan is profitable but falls short of your target by " +
        formatMoney(plan.targetGap) +
        ".",
    };
  }

  /**
   * How much of the startup cash the one-time purchases consume, and a risk band.
   * Returns null when there are no startup purchases. When there is no startup
   * cash but there are purchases, the plan is over budget (pct = Infinity).
   *   0–30%  healthy   · 31–60% watch · 61–80% risky · 81%+ veryRisky
   */
  function getStartupCashUsage(plan) {
    if (plan.startupPurchases <= 0) return null;
    var cash = plan.inputs.startingCash;
    var pct = cash > 0 ? (plan.startupPurchases / cash) * 100 : Infinity;
    var band;
    if (pct <= 30) band = "healthy";
    else if (pct <= 60) band = "watch";
    else if (pct <= 80) band = "risky";
    else band = "veryRisky";
    return { pct: pct, band: band, tight: band === "risky" || band === "veryRisky" };
  }

  /** "Startup purchases use N% of available startup cash" (or "more than 100%"). */
  function cashUsagePhrase(usage) {
    if (!isFinite(usage.pct)) {
      return "Startup purchases use more than all of your available startup cash";
    }
    return (
      "Startup purchases use " +
      Math.round(usage.pct) +
      "% of available startup cash"
    );
  }

  /** Build action-oriented, managerial planning-advice bullets from the numbers. */
  function renderPlanAdvice(plan, biggest) {
    var list = document.getElementById("plan-advice-list");
    if (!list) return;
    list.innerHTML = "";

    var advice = [];

    // 1) Target profit — framed as what to work on.
    if (plan.targetGap <= 0) {
      advice.push(
        "This plan meets your target monthly profit. A manager would now focus on " +
          "making these revenue and cost estimates realistic before committing to them."
      );
    } else {
      advice.push(
        "This plan is below the target profit by " +
          formatMoney(plan.targetGap) +
          ". To improve it, focus on raising revenue, reducing fixed expenses, or " +
          "lowering startup costs before launch."
      );
    }

    // 2) Revenue vs. expense level — advice, not just a fact.
    if (plan.totalExpenses > plan.inputs.revenue) {
      advice.push(
        "Revenue is not high enough to support the planned expense level. A manager " +
          "would review pricing, expected sales volume, or ways to reduce monthly costs."
      );
    }

    // 3) Startup purchases vs. available cash — show the percentage + guidance.
    var usage = getStartupCashUsage(plan);
    if (usage) {
      var tail;
      if (usage.band === "healthy") {
        tail =
          " — a healthy, flexible level that leaves a solid cash cushion to start.";
      } else if (usage.band === "watch") {
        tail =
          " — watch this carefully, since it leaves less room for slow early months.";
      } else if (usage.band === "risky") {
        tail =
          " — this is risky, and the cash cushion may be tight. A manager may consider " +
          "delaying purchases, buying used equipment, leasing, or increasing startup funding.";
      } else {
        tail =
          " — this is very risky; the business may start with too little cash left. A " +
          "manager may consider delaying purchases, buying used equipment, leasing, or " +
          "increasing startup funding.";
      }
      advice.push(cashUsagePhrase(usage) + tail);
    }

    // 4) Largest-cost lever, when the plan isn't already on target.
    if (biggest && (plan.targetGap > 0 || plan.totalExpenses > plan.inputs.revenue)) {
      advice.push(
        "Your largest planned cost is " +
          biggest.label.toLowerCase() +
          " (" +
          formatMoney(biggest.value) +
          "). Reducing or renegotiating it is often the fastest way to improve the plan."
      );
    }

    advice.slice(0, 4).forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }

  /** Push planning results into the plan dashboard UI. */
  function renderPlanResults(plan) {
    var empty = document.getElementById("plan-empty");
    var dashboard = document.getElementById("plan-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var name = plan.inputs.name.trim();
    var title = document.getElementById("plan-dash-title");
    if (title) {
      title.textContent = name
        ? name + " — Startup Plan Summary"
        : "Startup Plan Summary";
    }

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText("plan-out-revenue", formatMoney(plan.inputs.revenue));
    setText("plan-out-expenses", formatMoney(plan.totalExpenses));
    setText("plan-out-profit", formatMoney(plan.expectedProfit));
    setText(
      "plan-out-gap",
      plan.targetGap > 0 ? formatMoney(plan.targetGap) : "Met"
    );
    setText("plan-out-startup", formatMoney(plan.startupPurchases));
    setText("plan-out-cash", formatMoney(plan.cashLeft));

    var colorBySign = function (id, positive) {
      var card = document.getElementById(id);
      if (!card) return;
      card.classList.remove("is-positive", "is-negative");
      card.classList.add(positive ? "is-positive" : "is-negative");
    };
    colorBySign("plan-out-profit-card", plan.expectedProfit >= 0);
    colorBySign("plan-out-gap-card", plan.targetGap <= 0); // met = green
    colorBySign("plan-out-cash-card", plan.cashLeft >= 0);

    var health = getPlanHealth(plan);
    var banner = document.getElementById("plan-banner");
    if (banner) {
      banner.classList.remove(
        "health-good",
        "health-warn",
        "health-danger",
        "health-neutral"
      );
      banner.classList.add("health-" + health.state);
    }
    setText("plan-banner-message", health.message);

    var biggest = getBiggestBudget(plan);
    renderPlanAdvice(plan, biggest);
    renderPlanManager(plan, biggest);
    renderPlanAccounting(plan);
  }

  /** "Manager's View" — how a manager would read these numbers before launching. */
  function renderPlanManager(plan, biggest) {
    var list = document.getElementById("plan-manager-list");
    if (!list) return;
    list.innerHTML = "";

    var notes = [];

    // Framing: what a manager weighs before launch.
    notes.push(
      "As the manager, you would weigh revenue (" +
        formatMoney(plan.inputs.revenue) +
        "), expenses (" +
        formatMoney(plan.totalExpenses) +
        "), and cash left (" +
        formatMoney(plan.cashLeft) +
        ") against your largest cost to decide what to adjust before launching."
    );

    // Largest planned expense as a lever.
    if (biggest) {
      notes.push(
        "Your largest planned cost is " +
          biggest.label.toLowerCase() +
          " at " +
          formatMoney(biggest.value) +
          " — the first place a manager looks when trying to protect profit."
      );
    } else {
      notes.push(
        "No monthly expenses are budgeted yet, so a manager could not judge the cost " +
          "structure of this plan."
      );
    }

    // Reaching the target profit + what to adjust.
    if (plan.targetGap <= 0) {
      notes.push(
        "The plan reaches your target monthly profit, so a manager would double-check " +
          "that the revenue estimate is achievable rather than optimistic."
      );
    } else {
      notes.push(
        "The plan is short of your target profit by " +
          formatMoney(plan.targetGap) +
          ", so a manager would decide whether to raise revenue or trim costs to close the gap."
      );
    }

    // Cash position / runway read.
    if (plan.cashLeft < 0) {
      notes.push(
        "Cash left is negative, so a manager would not launch this plan without more " +
          "startup funding or lower upfront spending."
      );
    } else {
      var usage = getStartupCashUsage(plan);
      if (usage && usage.tight) {
        notes.push(
          "Cash left is positive but thin after startup purchases, so a manager would " +
            "keep a close eye on early-month cash flow."
        );
      } else {
        notes.push(
          "Cash left stays positive with a reasonable cushion, giving a manager room to " +
            "absorb slower early months."
        );
      }
    }

    notes.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }

  /**
   * "How This Connects to Accounting" — grouped by the three core statements,
   * then one tailored takeaway. Renders into a container div (not a flat list).
   */
  function renderPlanAccounting(plan) {
    var container = document.getElementById("plan-accounting-list");
    if (!container) return;
    container.innerHTML = "";

    // Append one titled group: heading + a small bulleted list of notes.
    var addGroup = function (title, notes) {
      if (!notes.length) return;
      var heading = document.createElement("p");
      heading.className = "plan-acct-heading";
      heading.textContent = title;
      container.appendChild(heading);

      var ul = document.createElement("ul");
      ul.className = "explanation-list";
      notes.forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    };

    // Income Statement
    addGroup("Income Statement Impact", [
      "Expected revenue (" +
        formatMoney(plan.inputs.revenue) +
        ") sits at the top of the income statement.",
      "Rent, wages, supplies, utilities, marketing, and other monthly costs (" +
        formatMoney(plan.totalExpenses) +
        " total) are operating expenses below it.",
      "The difference is your expected profit or loss of " +
        formatMoney(plan.expectedProfit) +
        " — the bottom line of the plan.",
    ]);

    // Balance Sheet
    var balanceNotes = [];
    if (plan.inputs.equipment > 0) {
      balanceNotes.push(
        "Equipment (" +
          formatMoney(plan.inputs.equipment) +
          ") is recorded as an asset first, then depreciated over its useful life."
      );
    }
    if (plan.inputs.inventory > 0) {
      balanceNotes.push(
        "Inventory (" +
          formatMoney(plan.inputs.inventory) +
          ") is recorded as an asset until it is sold."
      );
    }
    balanceNotes.push(
      "Cash is your main asset here — it moves from cash into equipment, inventory, " +
        "and day-to-day operations."
    );
    addGroup("Balance Sheet Impact", balanceNotes);

    // Cash Flow
    addGroup("Cash Flow Impact", [
      "Startup purchases (" +
        formatMoney(plan.startupPurchases) +
        ") reduce cash upfront, before the business earns anything.",
      "After startup costs and one month of operations, estimated cash left is " +
        formatMoney(plan.cashLeft) +
        ".",
    ]);

    // Tailored takeaway.
    var note = document.createElement("p");
    note.className = "plan-acct-note";
    var usage = getStartupCashUsage(plan);
    if (plan.cashLeft < 0) {
      note.textContent =
        "The plan runs cash negative after startup costs — profit on paper cannot " +
        "cover a shortfall in the bank, so the plan needs more cash to launch.";
    } else if (plan.expectedProfit > 0 && usage && usage.tight) {
      note.textContent =
        "Even though the plan shows a profit, startup purchases use a large share of " +
        "cash upfront — a profitable plan can still hit a cash problem early on.";
    } else if (plan.expectedProfit > 0) {
      note.textContent =
        "This plan shows a profit and keeps a reasonable cash cushion — a solid " +
        "starting point to refine before launch.";
    } else {
      note.textContent =
        "The plan does not yet show a profit, so both the income statement and the cash " +
        "position need work before launch.";
    }
    container.appendChild(note);
  }

  function validatePlanAll() {
    var firstInvalid = null;
    PLAN_REQUIRED_FIELDS.forEach(function (field) {
      var ok = validateField(field);
      if (!ok && !firstInvalid) {
        firstInvalid = document.getElementById(field.id);
      }
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function clearAllPlanErrors() {
    PLAN_REQUIRED_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (input) clearError(input);
    });
  }

  function initPlanLiveValidation() {
    PLAN_REQUIRED_FIELDS.forEach(function (field) {
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

  /** Live "Target: $X per month ($Y per year)." helper under the target field. */
  function updatePlanTargetHelper() {
    var input = document.getElementById("plan-target-profit");
    var helper = document.getElementById("plan-target-helper");
    if (!input || !helper) return;
    var raw = (input.value || "").trim();
    var value = Number(raw);
    if (raw === "" || isNaN(value) || value <= 0) {
      helper.textContent = "";
      return;
    }
    helper.textContent =
      "Target: " +
      formatMoneyCompact(value) +
      " per month (" +
      formatMoneyCompact(value * 12) +
      " per year).";
  }

  function initPlanning() {
    var form = document.getElementById("plan-form");
    if (!form) return;

    initPlanLiveValidation();

    // Live yearly-equivalent helper as the target profit is typed.
    var targetInput = document.getElementById("plan-target-profit");
    if (targetInput) {
      targetInput.addEventListener("input", updatePlanTargetHelper);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validatePlanAll()) return;
      renderPlanResults(calculatePlan());
    });

    form.addEventListener("reset", function () {
      clearAllPlanErrors();
      var helper = document.getElementById("plan-target-helper");
      if (helper) helper.textContent = "";
      var empty = document.getElementById("plan-empty");
      var dashboard = document.getElementById("plan-dashboard");
      if (dashboard) dashboard.hidden = true;
      if (empty) empty.hidden = false;
    });
  }

  /** Wire the Assessment / Planning mode tabs to show one panel at a time. */
  function initModeTabs() {
    var tabA = document.getElementById("mode-assessment");
    var tabP = document.getElementById("mode-planning");
    var panelA = document.getElementById("assessment-panel");
    var panelP = document.getElementById("planning-panel");
    var subtitle = document.getElementById("sim-subtitle");
    if (!tabA || !tabP || !panelA || !panelP) return;

    var ASSESS_SUB = subtitle ? subtitle.textContent : "";
    var PLAN_SUB =
      "Use Startup Planning Mode to design a starting budget, set a target profit, " +
      "and see whether your business plan has enough revenue and cash to work.";

    function activate(planning) {
      tabA.classList.toggle("is-active", !planning);
      tabP.classList.toggle("is-active", planning);
      tabA.setAttribute("aria-selected", planning ? "false" : "true");
      tabP.setAttribute("aria-selected", planning ? "true" : "false");
      panelA.hidden = planning;
      panelP.hidden = !planning;
      if (subtitle) subtitle.textContent = planning ? PLAN_SUB : ASSESS_SUB;
    }

    tabA.addEventListener("click", function () {
      activate(false);
    });
    tabP.addEventListener("click", function () {
      activate(true);
    });
  }

  /**
   * Force a blank form + default (empty) dashboard.
   * Some browsers restore previously typed values on refresh / bfcache
   * (notably number inputs), so we clear every field explicitly rather than
   * relying on autocomplete="off" alone.
   */
  function resetSimulatorState() {
    var form = document.getElementById("sim-form");
    if (!form) return;

    REQUIRED_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (input) input.value = "";
    });

    clearAllErrors();

    var empty = document.getElementById("sim-empty");
    var dashboard = document.getElementById("sim-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;

    // Planning Mode form + dashboard get the same fresh-start treatment.
    PLAN_REQUIRED_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (input) input.value = "";
    });
    clearAllPlanErrors();
    var planHelper = document.getElementById("plan-target-helper");
    if (planHelper) planHelper.textContent = "";
    var planEmpty = document.getElementById("plan-empty");
    var planDashboard = document.getElementById("plan-dashboard");
    if (planDashboard) planDashboard.hidden = true;
    if (planEmpty) planEmpty.hidden = false;
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

  /* ==========================================================
     Journal Entry Helper (first Accounting Tool)
     Reveal-only. Reads data + pure logic from journal-entry.js
     (window.JournalEntry) and renders a general-journal entry
     with a plain-English, rules-based explanation.
     ========================================================== */

  var JE_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  /** Today's date as an ISO "YYYY-MM-DD" string (local time). */
  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = "0" + m;
    if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }

  /** Format an ISO date for display, e.g. "Jun 25, 2026". Falls back to today. */
  function formatJeDate(iso) {
    var value = (iso || "").trim();
    var parts = value.split("-");
    if (parts.length !== 3) parts = todayIso().split("-");
    var year = parts[0];
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12) {
      return value; // unparseable but non-empty: show as-is rather than break
    }
    return JE_MONTHS[month - 1] + " " + day + ", " + year;
  }

  /** Past-tense of a posting side, for explanation sentences. */
  function jeSideWord(side) {
    return side === "debit" ? "debited" : "credited";
  }

  /** CSS modifier for an account-type badge. */
  function jeBadgeClass(line) {
    if (line.isContra) return "contra";
    switch (line.type) {
      case "Asset": return "asset";
      case "Liability": return "liability";
      case "Equity": return "equity";
      case "Revenue": return "revenue";
      case "Expense": return "expense";
      default: return "asset";
    }
  }

  function validateJeTransaction() {
    var select = document.getElementById("je-transaction");
    if (!select) return false;
    if (!select.value) {
      showError(select, "Choose a transaction.");
      return false;
    }
    clearError(select);
    return true;
  }

  /** Amount must be present, a valid number, and strictly greater than 0. */
  function validateJeAmount() {
    var input = document.getElementById("je-amount");
    if (!input) return false;
    var raw = (input.value || "").trim();
    if (raw === "") {
      showError(input, "Enter an amount.");
      return false;
    }
    var value = Number(raw);
    if (isNaN(value) || !isFinite(value)) {
      showError(input, "Enter a valid number.");
      return false;
    }
    if (value <= 0) {
      showError(input, "Enter an amount greater than 0.");
      return false;
    }
    clearError(input);
    return true;
  }

  /** Render the journal entry view-model into the output panel. */
  function renderJournalEntry(entry) {
    var empty = document.getElementById("je-empty");
    var dashboard = document.getElementById("je-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Preview header: date · transaction label
    setText("je-preview-date", formatJeDate(entry.date));
    setText("je-preview-label", entry.label);

    // Debit + credit rows (credit indented via .je-credit-row)
    var rows = document.getElementById("je-rows");
    if (rows) {
      rows.innerHTML = "";

      var debitRow = document.createElement("tr");
      debitRow.innerHTML =
        "<td>" + entry.debit.name + "</td>" +
        '<td class="num">' + formatMoney(entry.debit.amount) + "</td>" +
        '<td class="num">—</td>';
      rows.appendChild(debitRow);

      var creditRow = document.createElement("tr");
      creditRow.className = "je-credit-row";
      creditRow.innerHTML =
        "<td>" + entry.credit.name + "</td>" +
        '<td class="num">—</td>' +
        '<td class="num">' + formatMoney(entry.credit.amount) + "</td>";
      rows.appendChild(creditRow);
    }

    // Totals
    setText("je-total-debit", formatMoney(entry.totals.debit));
    setText("je-total-credit", formatMoney(entry.totals.credit));

    // Narration
    setText("je-narration", entry.narration);

    // Balance confirmation
    setText(
      "je-balance",
      "This entry balances because total debits equal total credits (" +
        formatMoney(entry.totals.debit) +
        " = " +
        formatMoney(entry.totals.credit) +
        ")."
    );

    // Per-account explanation (badge + plain-English sentence)
    var list = document.getElementById("je-explanation-list");
    if (list) {
      list.innerHTML = "";
      entry.lines.forEach(function (line) {
        var li = document.createElement("li");

        var badge = document.createElement("span");
        badge.className = "je-badge je-badge--" + jeBadgeClass(line);
        badge.textContent = line.type;
        li.appendChild(badge);

        var text = line.isContra
          ? line.note
          : line.name +
            " (" +
            line.type +
            ") is " +
            jeSideWord(line.side) +
            ", which " +
            line.direction +
            " it.";
        li.appendChild(document.createTextNode(" " + text));

        list.appendChild(li);
      });
    }
  }

  /** Reset the Journal Entry Helper to its empty state. */
  function resetJournalEntry() {
    var select = document.getElementById("je-transaction");
    var amount = document.getElementById("je-amount");
    var date = document.getElementById("je-date");
    if (select) {
      select.value = "";
      clearError(select);
    }
    if (amount) {
      amount.value = "";
      clearError(amount);
    }
    if (date) date.value = todayIso();

    var empty = document.getElementById("je-empty");
    var dashboard = document.getElementById("je-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initJournalEntry() {
    var form = document.getElementById("je-form");
    if (!form) return;
    var JE = window.JournalEntry;
    if (!JE) return; // journal-entry.js missing: leave the empty state in place

    // Populate the transaction dropdown from the single source of truth.
    var select = document.getElementById("je-transaction");
    if (select) {
      JE.TRANSACTIONS.forEach(function (tx) {
        var option = document.createElement("option");
        option.value = tx.id;
        option.textContent = tx.label;
        select.appendChild(option);
      });
    }

    // Default the date to today.
    var date = document.getElementById("je-date");
    if (date) date.value = todayIso();

    // Live-clear errors as the user fixes them.
    if (select) {
      select.addEventListener("change", function () {
        var wrapper = getFieldWrapper(select);
        if (wrapper && wrapper.classList.contains("has-error")) {
          validateJeTransaction();
        }
      });
    }
    var amount = document.getElementById("je-amount");
    if (amount) {
      amount.addEventListener("input", function () {
        var wrapper = getFieldWrapper(amount);
        if (wrapper && wrapper.classList.contains("has-error")) {
          validateJeAmount();
        }
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var okTransaction = validateJeTransaction();
      var okAmount = validateJeAmount();
      if (!okTransaction) {
        if (select) select.focus();
        return;
      }
      if (!okAmount) {
        if (amount) amount.focus();
        return;
      }
      var entry = JE.buildEntry(
        select.value,
        Number((amount.value || "").trim()),
        date ? date.value : todayIso()
      );
      if (entry) renderJournalEntry(entry);
    });

    form.addEventListener("reset", function () {
      // Let the native reset clear fields first, then restore our defaults.
      window.setTimeout(resetJournalEntry, 0);
    });
  }

  /* ==========================================================
     Bank Reconciliation Helper (second Accounting Tool)
     Reads data + pure logic from bank-reconciliation.js
     (window.BankReconciliation) and renders a two-sided
     reconciliation report with adjustment explanations and the
     journal entries the book-side items would require.
     ========================================================== */

  // id + whether the field must be filled in. Balances required; rest optional.
  var BR_MONEY_FIELDS = [
    { id: "br-bank-balance", required: true },
    { id: "br-book-balance", required: true },
    { id: "br-deposits", required: false },
    { id: "br-checks", required: false },
    { id: "br-fees", required: false },
    { id: "br-interest", required: false },
    { id: "br-error-amount", required: false },
  ];

  function brValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function readBrInputs() {
    return {
      bankBalance: brValue("br-bank-balance"),
      bookBalance: brValue("br-book-balance"),
      depositsInTransit: brValue("br-deposits"),
      outstandingChecks: brValue("br-checks"),
      bankServiceFees: brValue("br-fees"),
      interestEarned: brValue("br-interest"),
      errorAmount: brValue("br-error-amount"),
      errorSide: brValue("br-error-side"),
      errorDirection: brValue("br-error-direction"),
    };
  }

  /** Validate one money field. Required ones can't be blank; all must be >= 0. */
  function validateBrField(field) {
    var input = document.getElementById(field.id);
    if (!input) return true;
    var raw = (input.value || "").trim();
    if (raw === "") {
      if (field.required) {
        showError(input, "Enter an amount.");
        return false;
      }
      clearError(input);
      return true;
    }
    var value = Number(raw);
    if (isNaN(value) || !isFinite(value)) {
      showError(input, "Enter a valid number.");
      return false;
    }
    if (value < 0) {
      showError(input, "Enter 0 or more.");
      return false;
    }
    clearError(input);
    return true;
  }

  function validateBrAll() {
    var firstInvalid = null;
    BR_MONEY_FIELDS.forEach(function (field) {
      var ok = validateBrField(field);
      if (!ok && !firstInvalid) firstInvalid = document.getElementById(field.id);
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  /** Display string for a reconciliation line based on its sign. */
  function brLineAmount(line) {
    if (line.sign === "minus") return "(" + formatMoney(line.amount) + ")";
    if (line.sign === "plus") return "+ " + formatMoney(line.amount);
    return formatMoney(line.amount); // start line
  }

  /** Render one side's table body (start line + non-zero adjustments). */
  function renderBrSide(tbodyId, side) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = "";
    side.lines.forEach(function (line) {
      var tr = document.createElement("tr");
      if (line.sign === "start") tr.className = "br-start-row";
      tr.innerHTML =
        "<td>" + line.label + "</td>" +
        '<td class="num">' + brLineAmount(line) + "</td>";
      tbody.appendChild(tr);
    });
  }

  /** Plain-English sentence for a single adjustment line. */
  function brAdjustmentSentence(line) {
    switch (line.label) {
      case "Deposits in transit":
        return "Deposits in transit raise the bank side — the bank hasn't recorded them yet.";
      case "Outstanding checks":
        return "Outstanding checks lower the bank side — they haven't cleared the bank yet.";
      case "Interest earned":
        return "Interest earned raises the book side — add it to your cash.";
      case "Bank service fees":
        return "Bank service fees lower the book side — subtract them from your cash.";
      case "Bank error":
        return (
          "A bank error " +
          (line.sign === "minus" ? "lowers" : "raises") +
          " the bank side by " +
          formatMoney(line.amount) +
          " — the bank fixes this, not you."
        );
      case "Book error":
        return (
          "A book error " +
          (line.sign === "minus" ? "lowers" : "raises") +
          " the book side by " +
          formatMoney(line.amount) +
          " — correct it in your own records."
        );
      default:
        return line.label + ": " + formatMoney(line.amount) + ".";
    }
  }

  function renderBrExplanations(result) {
    var list = document.getElementById("br-explanation-list");
    if (!list) return;
    list.innerHTML = "";

    var adjustments = [];
    result.bank.lines.concat(result.book.lines).forEach(function (line) {
      if (line.sign !== "start") adjustments.push(line);
    });

    if (adjustments.length === 0) {
      var li = document.createElement("li");
      li.textContent =
        "No reconciling items entered — the bank and book balances are compared as-is.";
      list.appendChild(li);
      return;
    }

    adjustments.forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = brAdjustmentSentence(line);
      list.appendChild(li);
    });
  }

  function renderBrEntries(inputs) {
    var list = document.getElementById("br-entries-list");
    if (!list) return;
    list.innerHTML = "";

    var entries = window.BankReconciliation.suggestedEntries(inputs);
    if (entries.length === 0) {
      var li = document.createElement("li");
      li.textContent = "No adjustments entered, so there are no journal entries to record.";
      list.appendChild(li);
      return;
    }

    entries.forEach(function (entry) {
      var li = document.createElement("li");
      if (entry.needsEntry) {
        li.textContent =
          entry.item +
          ": Debit " +
          entry.debit +
          ", Credit " +
          entry.credit +
          " " +
          formatMoney(entry.amount) +
          ".";
      } else {
        li.textContent = entry.item + ": no entry needed — " + entry.note;
      }
      list.appendChild(li);
    });
  }

  function renderBankReconciliation(inputs) {
    var BR = window.BankReconciliation;
    var result = BR.reconcile(inputs);

    var empty = document.getElementById("br-empty");
    var dashboard = document.getElementById("br-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    renderBrSide("br-bank-rows", result.bank);
    renderBrSide("br-book-rows", result.book);
    setText("br-bank-adjusted", formatMoney(result.bank.adjusted));
    setText("br-book-adjusted", formatMoney(result.book.adjusted));

    var banner = document.getElementById("br-banner");
    if (banner) {
      banner.classList.remove(
        "health-good",
        "health-warn",
        "health-danger",
        "health-neutral"
      );
      banner.classList.add(result.reconciled ? "health-good" : "health-danger");
    }
    setText(
      "br-banner-message",
      result.reconciled
        ? "Reconciled — both adjusted balances equal " +
            formatMoney(result.bank.adjusted) +
            "."
        : "Not reconciled — difference of " +
            formatMoney(Math.abs(result.difference)) +
            ". Recheck the side that's off."
    );

    renderBrExplanations(result);
    renderBrEntries(inputs);
    renderBrInvestigation(result);
  }

  /** "How accountants would investigate this" — adapts to the reconcile result. */
  function renderBrInvestigation(result) {
    var text = document.getElementById("br-investigate-text");
    var list = document.getElementById("br-investigate-list");
    if (!text || !list) return;
    list.innerHTML = "";

    if (result.reconciled) {
      text.textContent =
        "The adjusted bank balance and adjusted book balance match, so the cash " +
        "balance is reconciled. An accountant would now record any needed book-side " +
        "journal entries, such as bank fees or interest.";
      return;
    }

    text.textContent =
      "The balances still do not match. An accountant would recheck the bank " +
      "statement, book cash records, deposits in transit, outstanding checks, bank " +
      "fees, interest, and possible errors to find the missing item.";

    [
      "Recheck the starting bank statement balance.",
      "Recheck the starting book cash balance.",
      "Look for a missing deposit in transit.",
      "Look for a missing outstanding check.",
      "Check whether bank fees or interest were entered.",
      "Check for a bank or book error.",
    ].forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
  }

  /**
   * Built-in example scenarios. Each fills the form and runs automatically so a
   * beginner can see a finished reconciliation before using their own numbers.
   *   1 — Timing Differences: deposits in transit + outstanding checks; reconciles.
   *   2 — Fees and Interest: book-side fee + interest entries; reconciles.
   *   3 — Find What's Missing: leaves a gap; does NOT reconcile.
   */
  var BR_EXAMPLES = {
    "1": {
      bankBalance: 5000, bookBalance: 5400,
      depositsInTransit: 1200, outstandingChecks: 800,
      bankServiceFees: 0, interestEarned: 0,
    },
    "2": {
      bankBalance: 3000, bookBalance: 3040,
      depositsInTransit: 0, outstandingChecks: 0,
      bankServiceFees: 50, interestEarned: 10,
    },
    "3": {
      bankBalance: 4000, bookBalance: 4000,
      depositsInTransit: 600, outstandingChecks: 1000,
      bankServiceFees: 0, interestEarned: 0,
    },
  };

  /** Fill the form with an example's numbers and run the reconciliation. */
  function applyBrExample(key) {
    var ex = BR_EXAMPLES[key];
    if (!ex) return;

    var setVal = function (id, value) {
      var el = document.getElementById(id);
      if (el) el.value = String(value);
    };
    setVal("br-bank-balance", ex.bankBalance);
    setVal("br-book-balance", ex.bookBalance);
    setVal("br-deposits", ex.depositsInTransit);
    setVal("br-checks", ex.outstandingChecks);
    setVal("br-fees", ex.bankServiceFees);
    setVal("br-interest", ex.interestEarned);

    // Examples don't use the advanced mistake correction: reset it.
    var errorAmount = document.getElementById("br-error-amount");
    var side = document.getElementById("br-error-side");
    var direction = document.getElementById("br-error-direction");
    if (errorAmount) errorAmount.value = "";
    if (side) side.value = "bank";
    if (direction) direction.value = "increase";

    // Clear any prior validation errors, then render.
    BR_MONEY_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (input) clearError(input);
    });
    renderBankReconciliation(readBrInputs());
  }

  function resetBankReconciliation() {
    BR_MONEY_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (input) {
        input.value = "";
        clearError(input);
      }
    });
    var side = document.getElementById("br-error-side");
    var direction = document.getElementById("br-error-direction");
    if (side) side.value = "bank";
    if (direction) direction.value = "increase";

    var empty = document.getElementById("br-empty");
    var dashboard = document.getElementById("br-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initBankReconciliation() {
    var form = document.getElementById("br-form");
    if (!form) return;
    if (!window.BankReconciliation) return; // module missing: keep empty state

    // Live-clear errors as the user fixes a field.
    BR_MONEY_FIELDS.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (!input) return;
      input.addEventListener("input", function () {
        var wrapper = getFieldWrapper(input);
        if (wrapper && wrapper.classList.contains("has-error")) {
          validateBrField(field);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateBrAll()) return;
      renderBankReconciliation(readBrInputs());
    });

    form.addEventListener("reset", function () {
      window.setTimeout(resetBankReconciliation, 0);
    });

    // Example buttons (outside the form): fill numbers and run automatically.
    var exampleButtons = document.querySelectorAll(".br-example-btn");
    exampleButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        applyBrExample(button.getAttribute("data-example"));
      });
    });
  }

  /* ==========================================================
     Depreciation Calculator (third Accounting Tool)
     Reads pure logic from depreciation.js (window.Depreciation)
     and renders summary cards, the yearly journal entry, a
     straight-line schedule, and a plain-English explanation.
     ========================================================== */

  function depValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  /** Validate one depreciation field; shows/clears the inline error. */
  function validateDepField(id) {
    var input = document.getElementById(id);
    if (!input) return true;
    var raw = (input.value || "").trim();

    if (id === "dep-name") {
      if (raw === "") {
        showError(input, "Asset name is required.");
        return false;
      }
      clearError(input);
      return true;
    }

    if (raw === "") {
      showError(input, "Enter a value.");
      return false;
    }
    var value = Number(raw);
    if (isNaN(value) || !isFinite(value)) {
      showError(input, "Enter a valid number.");
      return false;
    }

    if (id === "dep-cost") {
      if (value <= 0) {
        showError(input, "Cost must be greater than 0.");
        return false;
      }
    } else if (id === "dep-salvage") {
      if (value < 0) {
        showError(input, "Enter 0 or more.");
        return false;
      }
      var cost = Number(depValue("dep-cost"));
      if (isFinite(cost) && value >= cost) {
        showError(input, "Salvage must be less than the asset cost.");
        return false;
      }
    } else if (id === "dep-life") {
      if (value < 1 || value > 50 || Math.floor(value) !== value) {
        showError(input, "Enter a whole number of years (1–50).");
        return false;
      }
    }

    clearError(input);
    return true;
  }

  var DEP_FIELDS = ["dep-name", "dep-cost", "dep-salvage", "dep-life"];

  function validateDepAll() {
    var firstInvalid = null;
    DEP_FIELDS.forEach(function (id) {
      var ok = validateDepField(id);
      if (!ok && !firstInvalid) firstInvalid = document.getElementById(id);
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function renderDepreciation(result) {
    var empty = document.getElementById("dep-empty");
    var dashboard = document.getElementById("dep-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    var name = result.name.trim();
    setText("dep-title", name ? name + " — Depreciation" : "Depreciation");

    // Summary cards
    setText("dep-out-annual", formatMoney(result.annual));
    setText("dep-out-monthly", formatMoney(result.monthly));
    setText("dep-out-base", formatMoney(result.depreciableBase));
    setText(
      "dep-out-life",
      result.usefulLife + (result.usefulLife === 1 ? " year" : " years")
    );

    // Journal entry (annual amount)
    setText("dep-je-debit", formatMoney(result.journal.amount));
    setText("dep-je-credit", formatMoney(result.journal.amount));
    setText("dep-je-total-debit", formatMoney(result.journal.amount));
    setText("dep-je-total-credit", formatMoney(result.journal.amount));

    // Schedule rows
    var rows = document.getElementById("dep-schedule-rows");
    if (rows) {
      rows.innerHTML = "";
      result.schedule.forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + row.year + "</td>" +
          '<td class="num">' + formatMoney(row.expense) + "</td>" +
          '<td class="num">' + formatMoney(row.accumulated) + "</td>" +
          '<td class="num">' + formatMoney(row.bookValue) + "</td>";
        rows.appendChild(tr);
      });
    }

    // Plain-English explanation
    var list = document.getElementById("dep-explanation-list");
    if (list) {
      list.innerHTML = "";
      var notes = [
        "Straight-line depreciation spreads the depreciable cost evenly across the " +
          "asset's useful life, matching part of the cost to each year the asset helps " +
          "earn revenue — here the base (cost " +
          formatMoney(result.cost) +
          " minus salvage " +
          formatMoney(result.salvage) +
          " = " +
          formatMoney(result.depreciableBase) +
          ") becomes " +
          formatMoney(result.annual) +
          " per year (" +
          formatMoney(result.monthly) +
          " per month).",
        "Depreciation Expense is the part of the asset's cost used up this period — " +
          formatMoney(result.annual) +
          " for a full year — and it lowers profit on the income statement.",
        "Accumulated Depreciation is the total depreciation recorded so far. It builds " +
          "up each year as a contra-asset that lowers the asset's book value on the " +
          "balance sheet.",
        "Book Value is the asset's cost minus accumulated depreciation. It falls each " +
          "year until it reaches the salvage value of " +
          formatMoney(result.salvage) +
          ".",
        "Book value is an accounting value, not necessarily the real selling price.",
      ];
      notes.forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
    }
  }

  function resetDepreciation() {
    DEP_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (input) {
        input.value = "";
        clearError(input);
      }
    });
    var method = document.getElementById("dep-method");
    if (method) method.value = "straight-line";

    var empty = document.getElementById("dep-empty");
    var dashboard = document.getElementById("dep-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initDepreciation() {
    var form = document.getElementById("dep-form");
    if (!form) return;
    if (!window.Depreciation) return; // module missing: keep empty state

    // Live-clear errors as the user fixes a field.
    DEP_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("input", function () {
        var wrapper = getFieldWrapper(input);
        if (wrapper && wrapper.classList.contains("has-error")) {
          validateDepField(id);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateDepAll()) return;
      var result = window.Depreciation.calculateDepreciation({
        name: depValue("dep-name"),
        cost: Number(depValue("dep-cost")),
        salvage: Number(depValue("dep-salvage")),
        usefulLife: Number(depValue("dep-life")),
      });
      if (result) renderDepreciation(result);
    });

    form.addEventListener("reset", function () {
      window.setTimeout(resetDepreciation, 0);
    });

    // Example boxes: auto-fill the form fields with the example's values.
    var exampleButtons = document.querySelectorAll(".dep-example-btn");
    exampleButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var setVal = function (id, value) {
          var el = document.getElementById(id);
          if (el) {
            el.value = value;
            clearError(el);
          }
        };
        setVal("dep-name", button.getAttribute("data-name"));
        setVal("dep-cost", button.getAttribute("data-cost"));
        setVal("dep-salvage", button.getAttribute("data-salvage"));
        setVal("dep-life", button.getAttribute("data-life"));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSmoothScroll();
    initActiveNav();
    initMoneyInputs();
    initSimulator();
    initPlanning();
    initModeTabs();
    initJournalEntry();
    initBankReconciliation();
    initDepreciation();
    resetSimulatorState();
    resetJournalEntry();
    resetBankReconciliation();
    resetDepreciation();
  });

  // Also clear when the page is shown from the back/forward cache, where the
  // browser would otherwise restore the previously entered values.
  window.addEventListener("pageshow", function () {
    resetSimulatorState();
    resetJournalEntry();
    resetBankReconciliation();
    resetDepreciation();
  });
})();
