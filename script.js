/* ============================================================
   LedgerLab — script.js
   Starter interactions only.
   No calculators or accounting logic yet — that comes later.
   For now: smooth in-page scrolling to placeholder sections
   and a small active-nav highlight.
   ============================================================ */

/* ==========================================================
   Startup Planning math (pure, no DOM)
   Shared by the browser (window.StartupPlanCore) and the Node
   tests (require("../script.js")). Blank optional amounts are
   treated as 0 by the caller before they reach this code.
   ========================================================== */
(function (root) {
  "use strict";

  function num(value) {
    return typeof value === "number" && isFinite(value) ? value : 0;
  }

  /**
   *  - Planned expenses   = rent + wages + supplies + utilities + marketing + other
   *  - Expected profit    = expected revenue - planned expenses
   *  - Target profit gap  = target profit - expected profit   (> 0 means short)
   *  - Startup purchases  = equipment + inventory + other startup costs
   *  - Estimated cash left = cash to start - startup purchases + expected profit
   * hasTarget records whether the user entered a target at all, so a real $0
   * target can be told apart from "no target".
   */
  function computeStartupPlan(inputs) {
    var i = inputs || {};
    var totalExpenses =
      num(i.rent) + num(i.wages) + num(i.supplies) +
      num(i.utilities) + num(i.marketing) + num(i.other);
    var expectedProfit = num(i.revenue) - totalExpenses;
    var targetGap = num(i.targetProfit) - expectedProfit;
    var startupPurchases = num(i.equipment) + num(i.inventory) + num(i.otherStartup);
    var cashLeft = num(i.startingCash) - startupPurchases + expectedProfit;

    return {
      totalExpenses: totalExpenses,
      expectedProfit: expectedProfit,
      targetGap: targetGap,
      startupPurchases: startupPurchases,
      cashLeft: cashLeft,
      hasTarget: i.hasTarget === true,
    };
  }

  /**
   * Share of startup cash used by one-time startup purchases, plus a risk band.
   * Returns null when there are no startup purchases. With purchases but no
   * startup cash, the plan is over budget (pct = Infinity).
   *   0–30%  healthy   · 31–60% watch · 61–80% risky · 81%+ veryRisky
   */
  function startupCashUsage(startupPurchases, startingCash) {
    if (num(startupPurchases) <= 0) return null;
    var cash = num(startingCash);
    var pct = cash > 0 ? (startupPurchases / cash) * 100 : Infinity;
    var band;
    if (pct <= 30) band = "healthy";
    else if (pct <= 60) band = "watch";
    else if (pct <= 80) band = "risky";
    else band = "veryRisky";
    return { pct: pct, band: band, tight: band === "risky" || band === "veryRisky" };
  }

  var api = { computeStartupPlan: computeStartupPlan, startupCashUsage: startupCashUsage };

  // Dual export: Node (tests) + browser (window.StartupPlanCore).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.StartupPlanCore = api;
  }
})(typeof self !== "undefined" ? self : this);

(function () {
  "use strict";

  // Everything below drives the page; under Node (tests) only the core above loads.
  if (typeof document === "undefined") return;

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
   * "Read our mission" disclosure: toggles the full Mission paragraph
   * under the one-line summary. Collapsed by default.
   */
  function initMissionToggle() {
    var toggle = document.querySelector(".ll-mission-toggle");
    if (!toggle) return;
    var panel = document.getElementById(toggle.getAttribute("aria-controls"));
    var label = toggle.querySelector(".ll-mission-toggle-label");
    if (!panel || !label) return;

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      panel.classList.toggle("is-open", open);
      label.textContent = open ? "Hide mission" : "Read our mission";
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

    // The current section is the last one whose top has reached a line near
    // the header. This stays correct for short sections (like Our Mission)
    // on tall screens, where a fixed viewport band can catch two at once.
    function updateActive() {
      // Must match the observer's band below (top 25% of the viewport).
      var line = window.innerHeight * 0.25;
      var currentId = null;
      sections.forEach(function (section) {
        if (section.getBoundingClientRect().top <= line) {
          currentId = section.getAttribute("id");
        }
      });
      navLinks.forEach(function (link) {
        var isActive = link.getAttribute("href") === "#" + currentId;
        link.classList.toggle("is-active", isActive);
      });
    }

    // Fires whenever a section edge crosses into or out of the top 25%.
    var observer = new IntersectionObserver(updateActive, {
      rootMargin: "0px 0px -75% 0px",
    });

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

  /** Escape user-provided text before inserting it into innerHTML. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  /** The five monthly expense categories, in the order the form lists them. */
  function expenseItems(result) {
    return [
      { key: "rent", label: "Rent", value: result.inputs.rent },
      { key: "wages", label: "Wages", value: result.inputs.wages },
      { key: "supplies", label: "Supplies", value: result.inputs.supplies },
      { key: "utilities", label: "Utilities", value: result.inputs.utilities },
      { key: "other", label: "Other", value: result.inputs.other },
    ];
  }

  /** A category as the subject of a sentence, with a matching verb. */
  function expenseSubject(item) {
    if (item.key === "rent") return "Rent is";
    if (item.key === "other") return "Other expenses are";
    return item.label + " are";
  }

  /** How much of each $1 of revenue is profit, e.g. "About 28¢ of every $1". */
  function profitPerDollar(profit, revenue) {
    var cents = Math.round((profit / revenue) * 100);
    if (cents < 1) return "Less than 1¢ of every $1";
    if (cents >= 100) return "Nearly every $1";
    return "About " + cents + "¢ of every $1";
  }

  /** Share of total monthly expenses, as a whole-number percent string. */
  function expensePct(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(0) + "%" : "0%";
  }

  /**
   * Expense breakdown as a donut chart plus a legend with each category's
   * amount and share. The legend is the readable version of the chart; the
   * SVG carries a one-line summary for screen readers.
   */
  function renderBreakdown(result) {
    var box = document.getElementById("breakdown-chart");
    if (!box) return;
    box.innerHTML = "";

    var total = result.totalExpenses;
    if (total <= 0) {
      var empty = document.createElement("p");
      empty.className = "breakdown-empty";
      empty.textContent = "No monthly expenses entered yet.";
      box.appendChild(empty);
      return;
    }

    box.innerHTML = donutMarkup(expenseItems(result), total, "Monthly expenses");
  }

  /**
   * Donut + legend markup for a set of { key, label, value } items whose
   * values add up to total. Shared by Assessment and Startup Planning.
   */
  function donutMarkup(items, total, summaryLabel) {
    var radius = 46;
    var circumference = 2 * Math.PI * radius;
    var shown = items.filter(function (item) { return item.value > 0; });
    // A thin gap between segments, only when there is more than one.
    var gap = shown.length > 1 ? 1.6 : 0;

    var arcs = "";
    var offset = 0;
    shown.forEach(function (item) {
      var length = (item.value / total) * circumference;
      var dash = Math.max(length - gap, 0.01);
      arcs +=
        '<circle class="ll-donut-arc ll-donut--' + item.key + '" cx="60" cy="60" r="' + radius +
        '" stroke-dasharray="' + dash.toFixed(3) + " " + (circumference - dash).toFixed(3) +
        '" stroke-dashoffset="' + (-offset).toFixed(3) + '" />';
      offset += length;
    });

    var summary = summaryLabel + ": " + items.map(function (item) {
      return item.label + " " + expensePct(item.value, total);
    }).join(", ") + ".";

    var legend = items.map(function (item) {
      return (
        '<li class="' + (item.value > 0 ? "" : "is-zero") + '">' +
          '<span class="ll-donut-key ll-donut--' + item.key + '" aria-hidden="true"></span>' +
          '<span class="ll-donut-name">' + item.label + "</span>" +
          '<span class="ll-donut-amt">' + formatMoney(item.value) + "</span>" +
          '<span class="ll-donut-pct">' + expensePct(item.value, total) + "</span>" +
        "</li>"
      );
    }).join("");

    return (
      '<div class="ll-donut-figure">' +
        '<svg viewBox="0 0 120 120" role="img" aria-label="' + summary + '">' +
          '<circle class="ll-donut-track" cx="60" cy="60" r="' + radius + '" />' +
          '<g transform="rotate(-90 60 60)">' + arcs + "</g>" +
        "</svg>" +
        '<div class="ll-donut-center" aria-hidden="true">' +
          '<span class="ll-donut-total">' + formatMoneyCompact(total) + "</span>" +
          '<span class="ll-donut-caption">per month</span>' +
        "</div>" +
      "</div>" +
      '<ul class="ll-donut-legend">' + legend + "</ul>"
    );
  }

  /** Choose a business-health state from profit and remaining cash. */
  function getHealth(result) {
    if (result.cashRemaining < 0) {
      return {
        state: "danger",
        message:
          "Cash runs negative this month. Major purchases and expenses use more cash " +
          "than the business has.",
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
        "Your business is breaking even this month: revenue and expenses are " +
        "exactly equal.",
    };
  }

  /** "is-pos" / "is-neg" for a signed amount; zero stays neutral. */
  function signClass(amount) {
    if (amount > 0) return "is-pos";
    if (amount < 0) return "is-neg";
    return "";
  }

  /** One line of a worked calculation: operator, label (+ hint), amount. */
  function calcRow(op, label, hint, amount, total) {
    return (
      '<tr class="' + (total ? "ll-calc-total" : "") + '">' +
        '<td class="ll-calc-op" aria-hidden="true">' + op + "</td>" +
        '<th scope="row">' + label +
          (hint ? '<span class="ll-calc-hint">' + hint + "</span>" : "") + "</th>" +
        '<td class="ll-calc-amt' + (total ? " " + signClass(amount) : "") + '">' +
          formatMoney(amount) + "</td>" +
      "</tr>"
    );
  }

  /**
   * "How This Was Calculated": the two relationships behind the results,
   * written out with the user's own numbers.
   */
  function renderCalculation(result) {
    var box = document.getElementById("calc-body");
    if (!box) return;
    var p = result.profit;
    var resultWord = p < 0 ? "Loss" : "Profit";

    var profitTable =
      '<table class="ll-calc">' +
        '<caption>Profit for the month</caption>' +
        "<tbody>" +
          calcRow("", "Revenue", "what the business earned this month", result.inputs.revenue) +
          calcRow("−", "Monthly expenses", "rent, wages, supplies, utilities, and other costs combined",
            result.totalExpenses) +
          calcRow("=", resultWord, p < 0 ? "expenses were higher than revenue" : "what was left over",
            p, true) +
        "</tbody>" +
      "</table>";

    var cashTable =
      '<table class="ll-calc">' +
        '<caption>Cash at the end of the month</caption>' +
        "<tbody>" +
          calcRow("", "Starting cash", "what the business had at the start of the month",
            result.inputs.startingCash) +
          calcRow(p < 0 ? "−" : "+", p < 0 ? "This month’s loss" : "This month’s profit", "",
            Math.abs(p)) +
          calcRow("−", "Major cash purchases", "equipment and inventory bought this month",
            result.startupPurchases) +
          calcRow("=", "Cash remaining", "", result.cashRemaining, true) +
        "</tbody>" +
      "</table>";

    box.innerHTML =
      '<div class="ll-calc-pair">' + profitTable + cashTable + "</div>" +
      '<p class="ll-calc-note"><strong>Why purchases are separate.</strong> Equipment and ' +
      "inventory are things the business keeps, to use or to sell later. Paying for them takes " +
      "cash out right away, so they lower cash remaining. But in accounting they usually aren’t " +
      "counted as this month’s expenses, so they don’t lower this month’s profit.</p>";
  }

  /**
   * "What This Means": short interpretations of the result. Each sentence
   * reads the numbers; none of them repeats the arithmetic above.
   */
  function renderExplanation(result) {
    var list = document.getElementById("explanation-list");
    if (!list) return;
    list.innerHTML = "";

    var notes = [];
    var revenue = result.inputs.revenue;
    var p = result.profit;

    // 1) Was the month profitable, and by how much per dollar of sales?
    if (p > 0) {
      notes.push(result.totalExpenses > 0
        ? profitPerDollar(p, revenue) + " the business earned this month was left over as profit."
        : "There were no expenses this month, so all of the revenue was profit.");
    } else if (p < 0) {
      notes.push(
        "Expenses were " + formatMoney(Math.abs(p)) +
        " more than the revenue the business earned this month."
      );
    } else if (revenue > 0) {
      notes.push("Every dollar of revenue went to cover expenses, so nothing was left over as profit.");
    } else {
      notes.push("This month had no revenue and no expenses.");
    }

    // 2) Where cash stands after everything.
    var cash = result.cashRemaining;
    var bought = result.startupPurchases;
    if (cash < 0) {
      notes.push(
        "The business would run out of cash. After this month’s activity it would be " +
        formatMoney(Math.abs(cash)) + " short."
      );
    } else if (cash === 0) {
      notes.push("The business would end the month with no cash left over.");
    } else if (bought > 0) {
      notes.push(
        "The business still has a positive cash balance after paying for " + formatMoney(bought) +
        " of equipment and inventory."
      );
    } else {
      notes.push("The business ends the month with a positive cash balance.");
    }

    // 3) Which costs matter most.
    var ranked = expenseItems(result)
      .filter(function (item) { return item.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });
    if (ranked.length === 1) {
      notes.push(expenseSubject(ranked[0]) + " the only monthly expense entered.");
    } else if (ranked.length > 1) {
      var t = result.totalExpenses;
      var second = ranked[1].key === "other" ? "other expenses" : ranked[1].label.toLowerCase();
      notes.push(
        expenseSubject(ranked[0]).replace(/ (is|are)$/, "") + " and " + second +
        " are the largest monthly expenses, together making up " +
        expensePct(ranked[0].value + ranked[1].value, t) + " of the total."
      );
    }

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
          "<strong>" + formatMoney(result.yearlyProfit) + "</strong>.",
      };
    }
    if (result.yearlyProfit < 0) {
      return {
        state: "negative",
        message:
          "If these numbers continue, the business is projected to lose " +
          "<strong>" + formatMoney(Math.abs(result.yearlyProfit)) + "</strong> over the year.",
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
      // Same rule as the other values: a 0% margin stays neutral.
      if (result.inputs.revenue > 0 && result.profit !== 0) {
        marginCard.classList.add(result.profit > 0 ? "is-positive" : "is-negative");
      }
    }

    // Biggest expense + break-even revenue (= total monthly expenses).
    setText("out-biggest", biggest ? biggest.label : "—");
    setText("out-breakeven", formatMoney(result.totalExpenses));
  }

  /**
   * "What to Look at Next": two or three practical observations drawn from
   * this result (break-even headroom, the biggest cost, the cash position).
   */
  function renderSuggestions(result, biggest) {
    var list = document.getElementById("suggestion-list");
    if (!list) return;
    list.innerHTML = "";

    var notes = [];
    var p = result.profit;

    // 1) Distance from break-even.
    if (p > 0) {
      notes.push(
        "Revenue is " + formatMoney(p) + " above break-even, so the business has some room " +
        "before a slower month would turn into a loss."
      );
    } else if (p < 0) {
      notes.push(
        "Revenue is " + formatMoney(Math.abs(p)) + " below break-even. Earning that much more, " +
        "or spending that much less, would bring the month to $0 profit."
      );
    } else {
      notes.push(
        "Revenue is exactly at break-even, so any extra cost next month would mean a loss."
      );
    }

    // 2) The biggest cost is where changes have the most effect.
    if (biggest) {
      var match = expenseItems(result).filter(function (item) { return item.label === biggest.label; })[0];
      var expenseCount = expenseItems(result).filter(function (item) { return item.value > 0; }).length;
      notes.push(expenseCount === 1
        ? expenseSubject(match) + " your only monthly expense (" + formatMoney(biggest.value) + "). " +
          "If you want to improve profit, it is the cost to review."
        : expenseSubject(match) + " currently your largest monthly expense (" + formatMoney(biggest.value) +
          ", " + expensePct(biggest.value, result.totalExpenses) + " of the total). " +
          "If you want to improve profit, it is the first cost worth reviewing.");
    }

    // 3) Cash position after the month.
    var cash = result.cashRemaining;
    var bought = result.startupPurchases;
    if (cash < 0) {
      if (result.inputs.startingCash + p >= 0 && bought > 0) {
        notes.push(
          "Cash goes below zero because of the " + formatMoney(bought) + " in major purchases. " +
          "Buying in stages, or starting with more cash, would keep the balance positive."
        );
      } else {
        notes.push(
          "Cash goes below zero, so the business would need more starting cash, lower costs, " +
          "or more revenue to get through the month."
        );
      }
    } else if (cash === 0) {
      notes.push("With $0.00 in cash, the business would need new cash to cover any cost next month.");
    } else if (bought > 0) {
      notes.push(
        "The " + formatMoney(cash) + " left after its major purchases gives the business a " +
        "cushion for next month."
      );
    } else if (p > 0) {
      notes.push(
        "Profit and cash are both positive, so this month could help build a cash reserve."
      );
    }

    notes.slice(0, 3).forEach(function (text) {
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

    // Color the value by its sign: above zero green, below zero red, zero neutral.
    var colorBySign = function (id, amount) {
      var card = document.getElementById(id);
      if (!card) return;
      card.classList.remove("is-positive", "is-negative");
      if (amount > 0) card.classList.add("is-positive");
      else if (amount < 0) card.classList.add("is-negative");
    };
    colorBySign("out-profit-card", result.profit);
    colorBySign("out-cash-card", result.cashRemaining);
    colorBySign("out-year-profit-card", result.yearlyProfit);
    colorBySign("out-year-cash-card", result.yearEndCash);

    // Yearly trend message
    var trend = getYearlyTrend(result);
    var trendEl = document.getElementById("yearly-trend");
    if (trendEl) {
      trendEl.classList.remove("is-positive", "is-negative");
      if (trend.state === "positive") trendEl.classList.add("is-positive");
      else if (trend.state === "negative") trendEl.classList.add("is-negative");
      trendEl.innerHTML = trend.message; // built from fixed text + formatted numbers
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
    renderCalculation(result);
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

  // type: "text" (business name), "money" (required, numeric, >= 0) or
  // "money-optional" (blank allowed and treated as $0; otherwise as "money").
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

    // Optional money field: blank is fine (it counts as $0).
    if (field.type === "money-optional" && raw === "") {
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

  // Every Planning field. Only the business name, starting cash and expected
  // revenue are required; the rest may be left blank (treated as $0, and a
  // blank target means "no target"). Any value that is entered must be valid.
  var PLAN_REQUIRED_FIELDS = [
    { id: "plan-biz-name", type: "text" },
    { id: "plan-starting-cash", type: "money" },
    { id: "plan-target-profit", type: "money-optional" },
    { id: "plan-revenue", type: "money" },
    { id: "plan-rent", type: "money-optional" },
    { id: "plan-wages", type: "money-optional" },
    { id: "plan-supplies", type: "money-optional" },
    { id: "plan-utilities", type: "money-optional" },
    { id: "plan-marketing", type: "money-optional" },
    { id: "plan-other", type: "money-optional" },
    { id: "plan-equipment", type: "money-optional" },
    { id: "plan-inventory", type: "money-optional" },
    { id: "plan-other-startup", type: "money-optional" },
  ];

  /**
   * Read the Planning form and run the shared core (StartupPlanCore above).
   * Blank optional amounts read as 0; a blank target means "no target".
   */
  function calculatePlan() {
    var targetEl = document.getElementById("plan-target-profit");
    var inputs = {
      name: (document.getElementById("plan-biz-name") || {}).value || "",
      startingCash: readMoney("plan-starting-cash"),
      targetProfit: readMoney("plan-target-profit"),
      hasTarget: !!targetEl && targetEl.value.trim() !== "",
      revenue: readMoney("plan-revenue"),
      rent: readMoney("plan-rent"),
      wages: readMoney("plan-wages"),
      supplies: readMoney("plan-supplies"),
      utilities: readMoney("plan-utilities"),
      marketing: readMoney("plan-marketing"),
      other: readMoney("plan-other"),
      equipment: readMoney("plan-equipment"),
      inventory: readMoney("plan-inventory"),
      otherStartup: readMoney("plan-other-startup"),
    };

    var core = window.StartupPlanCore.computeStartupPlan(inputs);

    return {
      inputs: inputs,
      totalExpenses: core.totalExpenses,
      expectedProfit: core.expectedProfit,
      targetGap: core.targetGap,
      startupPurchases: core.startupPurchases,
      cashLeft: core.cashLeft,
      hasTarget: core.hasTarget,
    };
  }

  /** The six monthly cost categories, in the order the form lists them. */
  function planCostItems(plan) {
    return [
      { key: "rent", label: "Rent", value: plan.inputs.rent },
      { key: "wages", label: "Wages", value: plan.inputs.wages },
      { key: "supplies", label: "Supplies", value: plan.inputs.supplies },
      { key: "utilities", label: "Utilities", value: plan.inputs.utilities },
      { key: "marketing", label: "Marketing", value: plan.inputs.marketing },
      { key: "other", label: "Other monthly expenses", value: plan.inputs.other },
    ];
  }

  /** Monthly costs above $0, largest first. */
  function rankedPlanCosts(plan) {
    return planCostItems(plan)
      .filter(function (item) { return item.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /** A cost category as the subject of a sentence, with a matching verb. */
  function planCostSubject(item) {
    if (item.key === "rent" || item.key === "marketing") return item.label + " is";
    return item.label + " are";
  }

  /**
   * Plan status for the banner and the Plan Health card. Conditions are
   * checked in the same order as before (cash, then profit, then target);
   * break-even and "no target" only get their own wording.
   *   short      cash left is below $0
   *   loss       expected profit is below $0
   *   even       expected profit is exactly $0
   *   attention  profitable, but below a target the user entered
   *   workable   profitable, and no target or the target is met
   */
  function getPlanStatus(plan) {
    var p = plan.expectedProfit;
    if (plan.cashLeft < 0) {
      return {
        key: "short", tone: "danger", card: "risk",
        label: "Plan is short on cash", short: "Short on cash",
        message: "Startup purchases and the first month would use " +
          formatMoney(Math.abs(plan.cashLeft)) + " more cash than the plan has.",
      };
    }
    if (p < 0) {
      return {
        key: "loss", tone: "danger", card: "risk",
        label: "Expected monthly loss", short: "Monthly loss",
        message: "At these estimates, monthly costs are higher than expected revenue.",
      };
    }
    if (p === 0) {
      return {
        key: "even", tone: "neutral", card: "stable",
        label: "Break-even plan", short: "Break-even",
        message: "Expected revenue would cover monthly costs exactly, with no profit left over.",
      };
    }
    if (plan.hasTarget && plan.targetGap > 0) {
      return {
        key: "attention", tone: "warn", card: "watch",
        label: "Plan needs attention", short: "Needs attention",
        message: "The plan shows a monthly profit, but it is " + formatMoney(plan.targetGap) +
          " below your monthly target.",
      };
    }
    var cashTail = plan.cashLeft <= 0
      ? ", but it would use all of its starting cash."
      : plan.startupPurchases > 0
        ? " and leaves cash after its startup purchases."
        : " and leaves cash after the first month.";
    return {
      key: "workable", tone: "good", card: "strong",
      label: "Plan looks workable", short: "Looks workable",
      message: (plan.hasTarget
        ? "The plan shows a monthly profit that reaches your target"
        : "The plan shows a monthly profit") + cashTail,
    };
  }

  /** Startup cash usage for a plan (see StartupPlanCore.startupCashUsage). */
  function getStartupCashUsage(plan) {
    return window.StartupPlanCore.startupCashUsage(
      plan.startupPurchases,
      plan.inputs.startingCash
    );
  }

  /** One short line on how much of the starting cash the purchases take. */
  function cashUsageNote(usage) {
    if (!usage) return "No startup purchases planned.";
    if (usage.pct > 100) return "Startup purchases cost more than the starting cash.";
    return "Startup purchases use " + Math.round(usage.pct) + "% of starting cash.";
  }

  /** Percent of a scale, for bar positions. */
  function barPct(value, scale) {
    return scale > 0 ? Math.max(0, Math.min(100, (value / scale) * 100)) : 0;
  }

  function barSpan(cls, from, to) {
    return '<span class="' + cls + '" style="left:' + from.toFixed(2) + "%;width:" +
      Math.max(to - from, 0).toFixed(2) + '%"></span>';
  }

  /**
   * "Monthly Plan": expected revenue, monthly costs and the difference on
   * one shared scale, with break-even (= monthly costs) marked on each bar.
   * Then the optional profit target as a single line.
   */
  function renderPlanMonth(plan) {
    var box = document.getElementById("plan-month");
    if (!box) return;
    var rev = plan.inputs.revenue;
    var costs = plan.totalExpenses;
    var p = plan.expectedProfit;
    var scale = Math.max(rev, costs);
    var revAt = barPct(rev, scale);
    var costAt = barPct(costs, scale);
    var even = costs > 0 && scale > 0
      ? '<span class="ll-pm-even" style="left:' + costAt.toFixed(2) + '%"></span>'
      : "";

    var row = function (op, label, amount, bars, total) {
      return (
        '<div class="ll-pm-row' + (total ? " ll-pm-total" : "") + '">' +
          '<span class="ll-pm-op" aria-hidden="true">' + op + "</span>" +
          '<span class="ll-pm-label">' + label + "</span>" +
          '<span class="ll-pm-amt' + (total ? " " + signClass(amount) : "") + '">' +
            formatMoney(amount) + "</span>" +
          '<span class="ll-pm-track" aria-hidden="true">' + bars + even + "</span>" +
        "</div>"
      );
    };

    var resultBar = "";
    if (p > 0) resultBar = barSpan("ll-pm-bar ll-pm-bar--profit", costAt, revAt);
    else if (p < 0) resultBar = barSpan("ll-pm-bar ll-pm-bar--loss", revAt, costAt);

    var resultLabel = p < 0 ? "Expected monthly loss" : "Expected monthly profit";

    var evenNote = costs > 0
      ? "<strong>Break-even revenue: " + formatMoney(costs) + ".</strong> This is the monthly " +
        "revenue needed to cover the plan’s monthly operating costs. At break-even, monthly " +
        "profit is $0."
      : "<strong>Break-even revenue: $0.00.</strong> No monthly operating costs are planned, " +
        "so there is nothing for revenue to cover.";

    box.innerHTML =
      '<div class="ll-pm">' +
        row("", "Expected revenue", rev, barSpan("ll-pm-bar ll-pm-bar--rev", 0, revAt)) +
        row("−", "Monthly operating costs", costs, barSpan("ll-pm-bar ll-pm-bar--cost", 0, costAt)) +
        row("=", resultLabel, p, resultBar, true) +
      "</div>" +
      '<p class="ll-pm-even-note">' +
        (costs > 0 ? '<span class="ll-pm-even-key" aria-hidden="true"></span>' : "") +
        "<span>" + evenNote + "</span>" +
      "</p>" +
      planTargetLine(plan);
  }

  /** The optional monthly profit target, as one compact line. */
  function planTargetLine(plan) {
    if (!plan.hasTarget) {
      return '<p class="ll-pm-target is-none">No monthly profit target was set.</p>';
    }
    var gap = plan.targetGap;
    var rel;
    var cls = "";
    if (gap > 0) {
      rel = "Expected profit is " + formatMoney(gap) + " below the target.";
    } else if (gap < 0) {
      rel = "Expected profit is " + formatMoney(Math.abs(gap)) + " above the target.";
      cls = " is-pos";
    } else {
      rel = "Expected profit meets the target exactly.";
    }
    return (
      '<p class="ll-pm-target">' +
        '<span class="ll-pm-target-label">Monthly profit target: <strong>' +
          formatMoney(plan.inputs.targetProfit) + "</strong></span>" +
        '<span class="ll-pm-target-rel' + cls + '">' + rel + "</span>" +
      "</p>"
    );
  }

  /** "Monthly Operating Costs": the shared donut, six monthly categories only. */
  function renderPlanBreakdown(plan) {
    var box = document.getElementById("plan-breakdown-chart");
    if (!box) return;
    if (plan.totalExpenses <= 0) {
      box.innerHTML = '<p class="breakdown-empty">No monthly costs were entered.</p>';
      return;
    }
    box.innerHTML = donutMarkup(planCostItems(plan), plan.totalExpenses, "Monthly operating costs");
  }

  /**
   * "Startup Cash Use": one bar for the starting cash, split into the three
   * one-time purchases and what is left, then the ledger down to estimated
   * cash left (cash to start − startup purchases + expected profit).
   */
  function renderPlanCashUse(plan) {
    var box = document.getElementById("plan-cash-use");
    if (!box) return;
    var i = plan.inputs;
    var start = i.startingCash;
    var bought = plan.startupPurchases;
    var afterPurchases = start - bought;
    var p = plan.expectedProfit;
    var scale = Math.max(start, bought);

    var parts = [
      { key: "equipment", label: "Equipment", value: i.equipment },
      { key: "inventory", label: "Inventory", value: i.inventory },
      { key: "other-startup", label: "Other startup costs", value: i.otherStartup },
    ];

    var bar = "";
    var at = 0;
    parts.forEach(function (part) {
      if (part.value <= 0) return;
      var next = at + barPct(part.value, scale);
      bar += barSpan("ll-cu-seg ll-cu--" + part.key, at, next);
      at = next;
    });
    if (afterPurchases > 0) bar += barSpan("ll-cu-seg ll-cu--left", at, 100);
    var over = bought > start;
    if (over) {
      var startAt = barPct(start, scale);
      bar += barSpan("ll-cu-over", startAt, 100) +
        '<span class="ll-cu-start" style="left:' + startAt.toFixed(2) + '%"></span>';
    }

    var line = function (op, label, amount, opts) {
      var o = opts || {};
      return (
        '<tr class="' + (o.cls || "") + '">' +
          '<td class="ll-ledger-op" aria-hidden="true">' + op + "</td>" +
          '<th scope="row">' +
            '<span class="ll-cu-key ' + (o.key ? "ll-cu--" + o.key : "is-blank") + '" aria-hidden="true"></span>' +
            label + "</th>" +
          '<td class="ll-ledger-amt' + (o.signed ? " " + signClass(amount) : "") + '">' +
            formatMoney(amount) + "</td>" +
        "</tr>"
      );
    };

    var rows =
      line("", "Starting cash available", start) +
      parts.map(function (part) {
        return line("−", part.label, part.value, {
          key: part.key, cls: part.value > 0 ? "" : "is-zero",
        });
      }).join("") +
      line("=", "Cash after startup purchases", afterPurchases, {
        key: afterPurchases > 0 ? "left" : "", cls: "ll-ledger-sub", signed: afterPurchases < 0,
      }) +
      line(p < 0 ? "−" : "+", p < 0 ? "First month’s expected loss" : "First month’s expected profit",
        Math.abs(p)) +
      line("=", "Estimated cash left", plan.cashLeft, { cls: "ll-ledger-total", signed: true });

    var caption = over
      ? '<p class="ll-cu-caption">The red part is how far the startup purchases go past the ' +
        "starting cash.</p>"
      : "";

    box.innerHTML =
      (scale > 0
        ? '<div class="ll-cu-bar" role="img" aria-label="' + cashUsageNote(getStartupCashUsage(plan)) +
          '">' + bar + "</div>" + caption
        : "") +
      '<table class="ll-ledger" aria-label="Startup cash use"><tbody>' +
        rows + "</tbody></table>";
  }

  /**
   * "How This Was Calculated": the plan's two formulas, written out with
   * the user's own numbers, plus why startup purchases sit apart.
   */
  function renderPlanCalculation(plan) {
    var box = document.getElementById("plan-calc-body");
    if (!box) return;
    var p = plan.expectedProfit;
    var loss = p < 0;

    var monthTable =
      '<table class="ll-calc">' +
        "<caption>Expected monthly result</caption>" +
        "<tbody>" +
          calcRow("", "Expected monthly revenue", "your estimate for a typical month",
            plan.inputs.revenue) +
          calcRow("−", "Monthly operating costs",
            "rent, wages, supplies, utilities, marketing, and other monthly expenses",
            plan.totalExpenses) +
          calcRow("=", loss ? "Expected monthly loss" : "Expected monthly profit",
            loss ? "costs are higher than revenue"
              : p === 0 ? "revenue covers costs exactly" : "what is left each month",
            p, true) +
        "</tbody>" +
      "</table>";

    var cashTable =
      '<table class="ll-calc">' +
        "<caption>Startup cash position</caption>" +
        "<tbody>" +
          calcRow("", "Cash available for startup", "what the business has before opening",
            plan.inputs.startingCash) +
          calcRow("−", "One-time startup purchases", "equipment, inventory, and other startup costs",
            plan.startupPurchases) +
          calcRow(loss ? "−" : "+", loss ? "Expected monthly loss" : "Expected monthly profit",
            "one month at the planned numbers", Math.abs(p)) +
          calcRow("=", "Estimated cash left", "", plan.cashLeft, true) +
        "</tbody>" +
      "</table>";

    box.innerHTML =
      '<div class="ll-calc-pair">' + monthTable + cashTable + "</div>" +
      '<p class="ll-calc-note"><strong>Why startup purchases are separate.</strong> Monthly costs ' +
      "come back every month, so they lower monthly profit. Equipment, inventory, and other " +
      "startup costs are paid once, before opening. They use cash right away, so they lower cash " +
      "left, but they don’t lower monthly profit here. In accounting, equipment and inventory are " +
      "usually recorded as assets, things the business owns. Equipment becomes an expense slowly " +
      "through depreciation, and inventory becomes an expense when it is sold.</p>";
  }

  /**
   * "What This Means": what the plan's numbers say, in plain sentences.
   * No arithmetic here; that lives in How This Was Calculated.
   */
  function renderPlanMeaning(plan, ranked) {
    var notes = [];
    var p = plan.expectedProfit;
    var rev = plan.inputs.revenue;

    if (p > 0) {
      notes.push(plan.totalExpenses > 0
        ? "The plan is expected to make a monthly profit. " + profitPerDollar(p, rev) +
          " of expected revenue would be left over."
        : "The plan is expected to make a monthly profit.");
    } else if (p < 0) {
      notes.push(
        "The plan is expected to lose money each month at the current revenue and cost estimates."
      );
    } else {
      notes.push(
        "The plan is expected to break even. Revenue would cover monthly costs with nothing left over."
      );
    }

    var afterPurchases = plan.inputs.startingCash - plan.startupPurchases;
    if (afterPurchases < 0) {
      notes.push("The planned startup purchases would use more cash than is currently available.");
    } else if (plan.cashLeft < 0) {
      notes.push(
        "The starting cash covers the startup purchases, but the first month’s loss would push " +
        "cash below zero."
      );
    } else if (plan.cashLeft === 0) {
      notes.push("The plan would use all of its starting cash by the end of the first month.");
    } else if (plan.startupPurchases > 0) {
      notes.push("The startup still has cash left after its planned purchases.");
    } else {
      notes.push("No startup purchases are planned, so all of the starting cash stays available.");
    }

    if (ranked.length === 1) {
      notes.push(planCostSubject(ranked[0]) + " the only monthly cost entered.");
    } else if (ranked.length > 1) {
      var second = ranked[1].key === "other" ? "other monthly expenses" : ranked[1].label.toLowerCase();
      notes.push(
        planCostSubject(ranked[0]).replace(/ (is|are)$/, "") + " and " + second +
        " make up " + expensePct(ranked[0].value + ranked[1].value, plan.totalExpenses) +
        " of the monthly costs."
      );
    } else {
      notes.push("No monthly costs were entered, so all expected revenue counts as profit.");
    }

    if (plan.hasTarget) {
      notes.push(plan.targetGap > 0
        ? "The expected monthly profit is below the goal you entered."
        : "The expected monthly profit reaches the goal you entered.");
    }

    fillList("plan-meaning-list", notes);
  }

  /**
   * "What to Look at Next": two to four observations tied to the numbers
   * (break-even headroom, the target, the biggest cost, the cash cushion).
   */
  function renderPlanNext(plan, ranked) {
    var notes = [];
    var p = plan.expectedProfit;
    var costs = plan.totalExpenses;

    if (p < 0) {
      notes.push(
        "Expected monthly costs are " + formatMoney(Math.abs(p)) + " higher than expected " +
        "revenue. Revenue would need to reach " + formatMoney(costs) + " a month to break even."
      );
    } else if (p === 0) {
      notes.push(
        "Revenue is exactly at break-even, so any extra monthly cost would turn the plan into a loss."
      );
    } else {
      notes.push(
        "Expected revenue is " + formatMoney(p) + " above break-even. Revenue could come in that " +
        "much lower before the plan stops making a profit."
      );
    }

    if (plan.hasTarget && plan.targetGap > 0) {
      notes.push(
        "To reach the " + formatMoney(plan.inputs.targetProfit) + " monthly profit target, the plan " +
        "needs " + formatMoney(plan.targetGap) + " more profit each month, from more revenue, " +
        "lower monthly costs, or both."
      );
    }

    if (ranked.length === 1) {
      var only = planCostSubject(ranked[0]).split(" ");
      var verb = only.pop();
      notes.push(
        only.join(" ") + " (" + formatMoney(ranked[0].value) + ") " + verb + " the plan’s only " +
        "monthly cost, so any change to it changes profit by the same amount."
      );
    } else if (ranked.length) {
      notes.push(
        planCostSubject(ranked[0]) + " the largest monthly cost at " + formatMoney(ranked[0].value) +
        " (" + expensePct(ranked[0].value, costs) + " of the total). A change here moves profit the most."
      );
    }

    var start = plan.inputs.startingCash;
    var bought = plan.startupPurchases;
    var usage = getStartupCashUsage(plan);
    var cashNote;
    if (plan.cashLeft < 0) {
      cashNote = bought > start
        ? "Startup purchases are " + formatMoney(bought - start) + " more than the starting cash. " +
          "More starting cash, or buying less before opening, would close that gap."
        : "Cash would end the first month " + formatMoney(Math.abs(plan.cashLeft)) + " below zero. " +
          "More starting cash, or a smaller first-month loss, would keep it positive.";
    } else if (plan.cashLeft === 0) {
      cashNote = "The plan ends the first month with no cash to spare for a slow start.";
    } else if (usage && usage.tight) {
      cashNote =
        "Startup purchases use " + Math.round(usage.pct) + "% of starting cash, so the plan keeps " +
        "a smaller cushion of " + formatMoney(plan.cashLeft) + " for slow early months.";
    } else {
      cashNote =
        "The plan ends the first month with " + formatMoney(plan.cashLeft) + " in estimated cash" +
        (p < 0 ? ", but each month at a loss would keep lowering it." : ", a cushion for slow early months.");
    }
    // A cash shortfall is the most urgent thing to look at.
    if (plan.cashLeft < 0) notes.unshift(cashNote);
    else notes.push(cashNote);

    fillList("plan-next-list", notes.slice(0, 4));
  }

  /** Replace a list's items with one <li> per sentence. */
  function fillList(id, notes) {
    var list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = "";
    notes.forEach(function (text) {
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
      title.textContent = name ? name + " — Startup Plan" : "Startup Plan";
    }

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Status banner
    var status = getPlanStatus(plan);
    var banner = document.getElementById("plan-banner");
    if (banner) {
      banner.classList.remove("health-good", "health-warn", "health-danger", "health-neutral");
      banner.classList.add("health-" + status.tone);
    }
    setText("plan-status-label", status.label + ".");
    setText("plan-banner-message", status.message);

    // Plan at a Glance
    setText("plan-out-profit", formatMoney(plan.expectedProfit));
    setText("plan-out-cash", formatMoney(plan.cashLeft));
    setText("plan-out-startup", formatMoney(plan.startupPurchases));
    setText("plan-out-startup-help", plan.startupPurchases > 0
      ? "One-time purchases before opening."
      : "No one-time purchases planned.");
    setText("plan-out-health", status.short);
    setText("plan-out-health-help", cashUsageNote(getStartupCashUsage(plan)));

    // Sign colour: above zero green, below zero red, zero neutral.
    var colorBySign = function (id, amount) {
      var card = document.getElementById(id);
      if (!card) return;
      card.classList.remove("is-positive", "is-negative");
      if (amount > 0) card.classList.add("is-positive");
      else if (amount < 0) card.classList.add("is-negative");
    };
    colorBySign("plan-out-profit-card", plan.expectedProfit);
    colorBySign("plan-out-cash-card", plan.cashLeft);

    var healthCard = document.getElementById("plan-out-health-card");
    if (healthCard) {
      healthCard.classList.remove("status-strong", "status-stable", "status-watch", "status-risk");
      healthCard.classList.add("status-" + status.card);
    }

    var ranked = rankedPlanCosts(plan);
    renderPlanMonth(plan);
    renderPlanBreakdown(plan);
    renderPlanCashUse(plan);
    renderPlanCalculation(plan);
    renderPlanMeaning(plan, ranked);
    renderPlanNext(plan, ranked);
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

    initPlanGuide();

    form.addEventListener("reset", function () {
      clearAllPlanErrors();
      resetPlanGuide();
      var helper = document.getElementById("plan-target-helper");
      if (helper) helper.textContent = "";
      var empty = document.getElementById("plan-empty");
      var dashboard = document.getElementById("plan-dashboard");
      if (dashboard) dashboard.hidden = true;
      if (empty) empty.hidden = false;
    });
  }

  /* ==========================================================
     Interactive Mode (shared by Startup Planning and Assessment)
     A guided, one-question-at-a-time view of a mode's EXISTING
     form fields. Every answer is written straight into its
     canonical input as it is typed, so the standard form and the
     guide always show the same values. Running submits the real
     form, i.e. that mode's existing validation, calculation and
     rendering path. Nothing is calculated here.

     need: "required" — must be answered; no alternative action
           "answer"   — must be answered; $0 is a valid answer
           "choice"   — must be answered, either with an amount or with the
                        question's own alternative ("No — none", "None — $0",
                        "No — no target")
     In the guide a blank answer always means "not answered yet", never $0.
     ========================================================== */

  var GUIDE_ZERO_HINT = " Enter $0 if this does not apply.";
  var GUIDE_ZERO_MSG = "Enter an amount, or enter $0 if there is none.";

  /* ---- Startup Planning questions ---- */

  var PLAN_GUIDE_STEPS = [
    { id: "plan-biz-name", kind: "text", need: "required", group: "The basics", label: "Business name",
      q: "What is your business called?",
      help: "This name appears at the top of your plan." },
    { id: "plan-starting-cash", kind: "money", need: "required", group: "The basics", label: "Starting cash",
      q: "How much cash will you have available when you start?",
      help: "Savings, loans or investment you can spend before the business earns any money." },
    { id: "plan-revenue", kind: "money", need: "required", group: "The basics", label: "Expected monthly revenue",
      q: "Roughly how much monthly revenue do you expect to generate?",
      help: "An estimate is okay — use what you realistically expect in a typical month." },
    { id: "plan-rent", kind: "money", need: "answer", group: "Monthly costs", label: "Rent",
      q: "What will you pay in rent each month?",
      help: "Rent for a shop, office, studio or kitchen." + GUIDE_ZERO_HINT },
    { id: "plan-wages", kind: "money", need: "answer", group: "Monthly costs", label: "Wages",
      q: "How much will you pay in wages each month?",
      help: "Pay for anyone who works for the business." + GUIDE_ZERO_HINT },
    { id: "plan-supplies", kind: "money", need: "answer", group: "Monthly costs", label: "Supplies",
      q: "What will supplies cost each month?",
      help: "Everyday items you use up, such as packaging, ingredients or materials." + GUIDE_ZERO_HINT },
    { id: "plan-utilities", kind: "money", need: "answer", group: "Monthly costs", label: "Utilities",
      q: "What do you expect utilities to cost each month?",
      help: "Electricity, water, internet and phone." + GUIDE_ZERO_HINT },
    { id: "plan-marketing", kind: "money", need: "answer", group: "Monthly costs", label: "Marketing",
      q: "How much will you spend on marketing each month?",
      help: "Ads, flyers, sponsored posts and promotions." + GUIDE_ZERO_HINT },
    { id: "plan-other", kind: "money", need: "choice", group: "Monthly costs", label: "Other monthly expenses",
      q: "Any other monthly expenses?",
      help: "Insurance, software, bank fees — anything else that repeats every month.",
      alt: "No — none", altValue: "0",
      blankMsg: "Enter an amount, or choose No if there are none." },
    { id: "plan-equipment", kind: "money", need: "choice", group: "Startup costs", label: "Equipment",
      q: "How much will you spend on equipment?",
      help: "Long-lasting items such as machines, computers or furniture. Accounting records these as assets.",
      alt: "None — $0", altValue: "0",
      blankMsg: "Enter an amount, or choose None if you will not have this cost." },
    { id: "plan-inventory", kind: "money", need: "choice", group: "Startup costs", label: "Inventory",
      q: "How much inventory will you buy to get started?",
      help: "Goods you plan to sell. Inventory stays an asset until it is sold.",
      alt: "None — $0", altValue: "0",
      blankMsg: "Enter an amount, or choose None if you will not have this cost." },
    { id: "plan-other-startup", kind: "money", need: "choice", group: "Startup costs", label: "Other startup costs",
      q: "Any other one-time startup costs?",
      help: "Licenses, permits, deposits, signage or website setup — paid once before launch.",
      alt: "No — none", altValue: "0",
      blankMsg: "Enter an amount, or choose No if there are none." },
    { id: "plan-target-profit", kind: "money", need: "choice", group: "Your goal", label: "Profit target",
      q: "Do you have a monthly profit goal you’d like to reach?",
      help: "Now that you’ve estimated your monthly revenue and costs, do you have a profit goal you’d like the business to reach?",
      alt: "No — no target", altValue: "", noTarget: true,
      blankMsg: "Enter a target amount, or choose No if you do not have one." },
  ];

  // Review sheet: section title, the step ids it lists (in question order),
  // and the calculatePlan() total shown under it (if any).
  var PLAN_GUIDE_REVIEW = [
    { title: "Basics", ids: ["plan-biz-name", "plan-starting-cash", "plan-revenue"] },
    { title: "Monthly costs", total: { label: "Total monthly costs", key: "totalExpenses" },
      ids: ["plan-rent", "plan-wages", "plan-supplies", "plan-utilities", "plan-marketing", "plan-other"] },
    { title: "Startup costs", total: { label: "Total startup costs", key: "startupPurchases" },
      ids: ["plan-equipment", "plan-inventory", "plan-other-startup"] },
    { title: "Goal", ids: ["plan-target-profit"] },
  ];

  /* ---- Assessment questions ---- */

  var ASSESS_ZERO_HELP = "Enter $0 if this did not apply.";
  var ASSESS_ZERO_MSG = "Enter an amount, or enter $0 if there was none.";

  var ASSESS_GUIDE_STEPS = [
    { id: "biz-name", kind: "text", need: "required", group: "The basics", label: "Business name",
      q: "What is your business called?",
      help: "This name appears at the top of your assessment." },
    { id: "starting-cash", kind: "money", need: "required", group: "The basics", label: "Starting cash",
      q: "How much cash did the business have at the start of the month?",
      help: "Enter the cash available before this month’s activity." },
    { id: "monthly-revenue", kind: "money", need: "required", group: "The basics", label: "Monthly revenue",
      q: "Roughly how much revenue did the business generate this month?",
      help: "Use the actual amount if you know it, or a reasonable estimate for practice." },
    { id: "rent", kind: "money", need: "answer", group: "Monthly expenses", label: "Rent",
      q: "How much did the business spend on rent this month?",
      help: ASSESS_ZERO_HELP, blankMsg: ASSESS_ZERO_MSG },
    { id: "wages", kind: "money", need: "answer", group: "Monthly expenses", label: "Wages",
      q: "How much did the business spend on wages this month?",
      help: ASSESS_ZERO_HELP, blankMsg: ASSESS_ZERO_MSG },
    { id: "supplies", kind: "money", need: "answer", group: "Monthly expenses", label: "Supplies",
      q: "How much did the business spend on supplies this month?",
      help: ASSESS_ZERO_HELP, blankMsg: ASSESS_ZERO_MSG },
    { id: "utilities", kind: "money", need: "answer", group: "Monthly expenses", label: "Utilities",
      q: "How much did the business spend on utilities this month?",
      help: ASSESS_ZERO_HELP, blankMsg: ASSESS_ZERO_MSG },
    { id: "other", kind: "money", need: "choice", group: "Monthly expenses", label: "Other",
      q: "Any other monthly expenses?",
      help: "Insurance, software, bank fees — anything else the business paid this month.",
      alt: "No — none", altValue: "0",
      blankMsg: "Enter an amount, or choose No if there were none." },
    { id: "equipment", kind: "money", need: "choice", group: "Major cash purchases", label: "Equipment",
      q: "How much did the business spend on equipment this month?",
      help: "Machines, computers or furniture. This reduces cash now, but is treated differently from normal monthly expenses.",
      alt: "None — $0", altValue: "0",
      blankMsg: "Enter an amount, or choose None if there was no equipment purchase." },
    { id: "inventory", kind: "money", need: "choice", group: "Major cash purchases", label: "Inventory",
      q: "How much inventory did the business purchase this month?",
      help: "Goods bought to sell. This reduces cash now, but is not counted as a monthly expense.",
      alt: "None — $0", altValue: "0",
      blankMsg: "Enter an amount, or choose None if there was no inventory purchase." },
  ];

  // Totals come from calculateSimulation(), the same engine as the results.
  var ASSESS_GUIDE_REVIEW = [
    { title: "Basics", ids: ["biz-name", "starting-cash", "monthly-revenue"] },
    { title: "Monthly expenses", total: { label: "Total monthly expenses", key: "totalExpenses" },
      ids: ["rent", "wages", "supplies", "utilities", "other"] },
    { title: "Major cash purchases", total: { label: "Total major purchases", key: "startupPurchases" },
      ids: ["equipment", "inventory"] },
  ];

  /**
   * Wire one Interactive Mode panel. cfg:
   *   prefix      — guide element ids are "<prefix>-guide-*"
   *   formId      — the mode's real form (submitted by Run)
   *   standardId  — wrapper of the standard fields (hidden while guiding)
   *   dashTitleId — results heading focused after a successful run
   *   fields      — the mode's validation list (id + type)
   *   steps, review, calculate — questions, review sheet, totals engine
   * Returns { reset } or null when the panel is not on the page.
   */
  function createGuide(cfg) {
    var STEPS = cfg.steps;

    // editEnd: while editing a review section, the index of that section's last
    // question; reaching it returns to the review instead of continuing on.
    // noTarget: the user answered a noTarget question with "No — no target".
    // The plan itself stores "no target" as a blank target field (hasTarget), so
    // this flag is what lets the guide tell "chose No" apart from "not answered".
    // started: the intro has been passed; until then (and again after Reset)
    // opening the guide shows the intro instead of a question.
    var state = { index: 0, atReview: false, editEnd: null, noTarget: false, started: false };

    function guideEl(id) {
      return document.getElementById(id);
    }

    function part(name) {
      return guideEl(cfg.prefix + "-guide-" + name);
    }

    if (!guideEl(cfg.prefix + "-guide")) return null;

    function stepIndex(id) {
      for (var i = 0; i < STEPS.length; i++) {
        if (STEPS[i].id === id) return i;
      }
      return -1;
    }

    function fieldFor(id) {
      for (var i = 0; i < cfg.fields.length; i++) {
        if (cfg.fields[i].id === id) return cfg.fields[i];
      }
      return null;
    }

    /** The guide input currently in use (text for the name, money otherwise). */
    function guideInput() {
      var step = STEPS[state.index];
      return part(step.kind === "text" ? "text" : "money");
    }

    /** True when the current question ends the flow (or the section being edited). */
    function atEnd() {
      var last = state.editEnd !== null ? state.editEnd : STEPS.length - 1;
      return state.index >= last;
    }

    /** Write a value into the canonical input and notify its listeners. */
    function write(id, value) {
      var target = guideEl(id);
      if (!target) return;
      target.value = value;
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /** Copy the canonical field's error state (if any) onto the guide input. */
    function mirrorError(id) {
      var input = guideInput();
      var source = guideEl(id);
      var wrapper = source ? getFieldWrapper(source) : null;
      if (wrapper && wrapper.classList.contains("has-error")) {
        var msg = wrapper.querySelector(".field-error");
        showError(input, msg ? msg.textContent : "Please enter a valid number.");
      } else {
        clearError(input);
      }
    }

    /** True when a question still has no answer (blank, and no "No" choice made). */
    function unanswered(step) {
      if (guideEl(step.id).value.trim() !== "") return false;
      return !(step.noTarget && state.noTarget);
    }

    /** First question without an answer, or -1 when every question is answered. */
    function firstUnanswered() {
      for (var i = 0; i < STEPS.length; i++) {
        if (unanswered(STEPS[i])) return i;
      }
      return -1;
    }

    /**
     * Validate the current answer. Required questions use the mode's existing
     * rules and messages. Every other question must also be answered here: a
     * blank never silently becomes $0.
     */
    function validate() {
      var step = STEPS[state.index];
      if (step.need !== "required" && unanswered(step)) {
        showError(guideInput(), step.blankMsg || GUIDE_ZERO_MSG);
        return false;
      }
      var ok = validateField(fieldFor(step.id));
      mirrorError(step.id);
      return ok;
    }

    function setProgress(position, label) {
      var total = STEPS.length;
      part("count").textContent = label;
      var track = part("track");
      track.setAttribute("aria-valuenow", String(position));
      track.setAttribute("aria-valuetext", label);
      part("fill").style.width = (position / total) * 100 + "%";
    }

    /** Show the short orientation, or the numbered questions/review with their progress. */
    function setIntro(on) {
      var intro = part("intro");
      if (intro) intro.hidden = !on;
      part("progress").hidden = on;
    }

    /** Replay the short entrance transition (skipped for reduced motion in CSS). */
    function animate(el) {
      el.classList.remove("is-entering");
      void el.offsetWidth;
      el.classList.add("is-entering");
    }

    function showStep(index) {
      var step = STEPS[index];
      var total = STEPS.length;
      state.index = index;
      state.atReview = false;

      setIntro(false);
      part("review").hidden = true;
      var panel = part("step");
      panel.hidden = false;

      setProgress(index + 1, "Question " + (index + 1) + " of " + total);
      part("group").textContent = step.group;
      part("q").textContent = step.q;
      part("help").textContent = step.help;
      var need = part("need");
      need.textContent = step.need === "choice" ? "Optional" : "Required";
      need.className = "ll-guide-need" + (step.need === "choice" ? " is-optional" : "");

      var isText = step.kind === "text";
      part("text").hidden = !isText;
      part("money-wrap").hidden = isText;
      var input = guideInput();
      part("q").setAttribute("for", input.id);
      input.value = guideEl(step.id).value;
      mirrorError(step.id);

      var alt = part("alt");
      alt.hidden = step.need !== "choice";
      alt.textContent = step.alt || "";
      updateChosen();

      part("back").hidden = index === 0;
      part("next-label").textContent = state.editEnd !== null && atEnd()
        ? "Back to review"
        : index === total - 1
          ? "Review answers"
          : "Continue";

      animate(panel);
      input.focus();
    }

    /** On a noTarget question, note that "No — no target" was chosen. */
    function updateChosen() {
      var chosen = part("chosen");
      if (!chosen) return;
      var step = STEPS[state.index];
      chosen.hidden = !(step.noTarget && state.noTarget && guideEl(step.id).value.trim() === "");
    }

    /** The value shown for one answer on the review sheet. */
    function reviewValue(step) {
      var raw = guideEl(step.id).value.trim();
      if (step.kind === "text") return { text: raw };
      if (raw === "") {
        return step.noTarget
          ? { text: "No target set", empty: true }
          : { text: formatMoneyCompact(0), empty: true };
      }
      return { text: formatMoneyCompact(readMoney(step.id)) };
    }

    function reviewRow(label, value, extraClass) {
      var row = document.createElement("div");
      row.className = "ll-guide-row" + (extraClass ? " " + extraClass : "");
      var dt = document.createElement("dt");
      dt.textContent = label;
      var dd = document.createElement("dd");
      dd.textContent = value.text;
      if (value.empty) dd.className = "is-empty";
      row.appendChild(dt);
      row.appendChild(dd);
      return row;
    }

    function showReview() {
      state.atReview = true;
      state.editEnd = null;
      setIntro(false);
      part("step").hidden = true;

      var totals = cfg.calculate(); // same engine as the results; used for totals only
      var sheet = part("sheet");
      sheet.innerHTML = "";

      cfg.review.forEach(function (section) {
        var wrap = document.createElement("section");
        wrap.className = "ll-guide-section";

        var head = document.createElement("div");
        head.className = "ll-guide-section-head";
        var title = document.createElement("h5");
        title.className = "ll-guide-sheet-title";
        title.textContent = section.title;
        var edit = document.createElement("button");
        edit.type = "button";
        edit.className = "ll-guide-edit";
        edit.textContent = "Edit";
        edit.setAttribute("aria-label", "Edit " + section.title.toLowerCase());
        edit.addEventListener("click", function () {
          var first = stepIndex(section.ids[0]);
          state.editEnd = stepIndex(section.ids[section.ids.length - 1]);
          showStep(first);
        });
        head.appendChild(title);
        head.appendChild(edit);
        wrap.appendChild(head);

        var dl = document.createElement("dl");
        dl.className = "ll-guide-rows";
        section.ids.forEach(function (id) {
          var step = STEPS[stepIndex(id)];
          dl.appendChild(reviewRow(step.label, reviewValue(step)));
        });
        if (section.total) {
          dl.appendChild(reviewRow(section.total.label,
            { text: formatMoneyCompact(totals[section.total.key]) }, "is-total"));
        }
        wrap.appendChild(dl);
        sheet.appendChild(wrap);
      });

      setProgress(STEPS.length, "Review: all " + STEPS.length + " questions answered");
      var review = part("review");
      review.hidden = false;
      animate(review);
      part("review-title").focus();
    }

    function advance() {
      if (atEnd()) showReview();
      else showStep(state.index + 1);
    }

    function next() {
      if (!validate()) {
        guideInput().focus();
        return;
      }
      advance();
    }

    /** The question's own alternative answer: "No — none", "None — $0", "No — no target". */
    function chooseAlt() {
      var step = STEPS[state.index];
      if (step.need !== "choice") return;
      guideInput().value = step.altValue;
      write(step.id, step.altValue);
      if (step.noTarget) state.noTarget = true;
      validateField(fieldFor(step.id)); // clears any earlier error on the field
      mirrorError(step.id);
      advance();
    }

    function back() {
      if (state.index > 0) showStep(state.index - 1);
    }

    /** Orientation before question 1: not numbered, no progress, no Back. */
    function showIntro() {
      part("step").hidden = true;
      part("review").hidden = true;
      setIntro(true);
      animate(part("intro"));
      part("intro-title").focus();
    }

    function start() {
      state.started = true;
      showStep(0);
    }

    function open() {
      guideEl(cfg.standardId).hidden = true;
      part("entry").hidden = true;
      setLede(false);
      part("open").setAttribute("aria-expanded", "true");
      guideEl(cfg.prefix + "-guide").hidden = false;
      if (!state.started && part("intro")) {
        showIntro();
        return;
      }
      // The standard form may have been edited meanwhile: go back to the first
      // unanswered question instead of a review with gaps.
      var gap = firstUnanswered();
      if (state.atReview && gap === -1) showReview();
      else if (state.atReview) showStep(gap);
      else showStep(state.index);
    }

    /** The standard view's framing sentence (the intro covers it in the guide). */
    function setLede(on) {
      var lede = part("lede");
      if (lede) lede.hidden = !on;
    }

    /** Leave the guide. Answers already live in the canonical fields, so nothing is lost. */
    function close(restoreFocus) {
      var panel = guideEl(cfg.prefix + "-guide");
      if (!panel) return;
      panel.hidden = true;
      guideEl(cfg.standardId).hidden = false;
      part("entry").hidden = false;
      setLede(true);
      var openBtn = part("open");
      openBtn.setAttribute("aria-expanded", "false");
      if (restoreFocus) openBtn.focus();
    }

    /** Back to question 1 with the standard form showing (used by Reset). */
    function reset() {
      state.index = 0;
      state.atReview = false;
      state.editEnd = null;
      state.noTarget = false;
      state.started = false;
      ["text", "money"].forEach(function (name) {
        var input = part(name);
        if (input) {
          input.value = "";
          clearError(input);
        }
      });
      close(false);
    }

    /** Run through the real form submission, then show the results. */
    function run() {
      var form = guideEl(cfg.formId);
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }

      var invalid = guideEl(cfg.standardId).querySelector(".field.has-error input");
      if (invalid) {
        var at = stepIndex(invalid.id);
        state.editEnd = at;
        showStep(at);
        return;
      }

      close(false);
      var title = guideEl(cfg.dashTitleId);
      if (title) title.focus();
    }

    part("open").addEventListener("click", open);
    if (part("start")) part("start").addEventListener("click", start);
    part("exit").addEventListener("click", function () {
      close(true);
    });
    part("next").addEventListener("click", next);
    part("back").addEventListener("click", back);
    part("alt").addEventListener("click", chooseAlt);

    // Typing a target (here or in the standard form) replaces a "No" choice.
    STEPS.forEach(function (step) {
      if (!step.noTarget) return;
      guideEl(step.id).addEventListener("input", function () {
        if (this.value.trim() !== "") state.noTarget = false;
      });
    });
    part("review-back").addEventListener("click", function () {
      showStep(STEPS.length - 1);
    });
    part("run").addEventListener("click", run);

    ["text", "money"].forEach(function (name) {
      var input = part(name);
      // Write-through: the canonical field always holds the current answer.
      input.addEventListener("input", function () {
        var step = STEPS[state.index];
        write(step.id, input.value);
        if (getFieldWrapper(input).classList.contains("has-error")) validate();
        updateChosen();
      });
      // Enter continues instead of submitting the whole form mid-flow.
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          next();
        }
      });
    });

    // Tooltip: shown on hover and keyboard focus (CSS); Escape hides it
    // without moving focus or touching any answers.
    var tipBtn = part("info");
    var tip = tipBtn.parentNode;
    tipBtn.addEventListener("keydown", function (event) {
      if (event.key === "Escape") tip.classList.add("is-dismissed");
    });
    tipBtn.addEventListener("blur", function () {
      tip.classList.remove("is-dismissed");
    });
    tip.addEventListener("mouseleave", function () {
      tip.classList.remove("is-dismissed");
    });

    return { reset: reset };
  }

  var planGuide = null;
  var assessGuide = null;

  function initPlanGuide() {
    planGuide = createGuide({
      prefix: "plan", formId: "plan-form", standardId: "plan-standard",
      dashTitleId: "plan-dash-title", fields: PLAN_REQUIRED_FIELDS,
      steps: PLAN_GUIDE_STEPS, review: PLAN_GUIDE_REVIEW, calculate: calculatePlan,
    });
  }

  function resetPlanGuide() {
    if (planGuide) planGuide.reset();
  }

  function initAssessGuide() {
    assessGuide = createGuide({
      prefix: "sim", formId: "sim-form", standardId: "sim-standard",
      dashTitleId: "dash-title", fields: REQUIRED_FIELDS,
      steps: ASSESS_GUIDE_STEPS, review: ASSESS_GUIDE_REVIEW, calculate: calculateSimulation,
    });
  }

  function resetAssessGuide() {
    if (assessGuide) assessGuide.reset();
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
    resetAssessGuide();

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
    resetPlanGuide();
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

    initAssessGuide();

    form.addEventListener("reset", function () {
      clearAllErrors();
      resetAssessGuide();
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

  /** Plural-friendly element name for a contra account's effect ("assets"). */
  function jeElementWord(element) {
    return element === "Asset" ? "assets" : element.toLowerCase();
  }

  /** "Increases" / "Decreases", or for a contra account its effect on the element. */
  function jeEffectText(line) {
    var verb = line.direction.charAt(0).toUpperCase() + line.direction.slice(1);
    return line.isContra ? verb + " " + jeElementWord(line.elementLabel) : verb;
  }

  /** Render the journal entry view-model as a general-journal document. */
  function renderJournalEntry(entry) {
    var empty = document.getElementById("je-empty");
    var dashboard = document.getElementById("je-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Debit line, indented credit line, then the explanation line beneath.
    var rows = document.getElementById("je-rows");
    if (rows) {
      // On phones the date moves to its own line above the entry (CSS).
      rows.innerHTML =
        '<tr class="ll-je-daterow"><td colspan="4">' + escapeHtml(formatJeDate(entry.date)) + "</td></tr>" +
        '<tr class="ll-je-debit">' +
          '<td class="ll-je-date">' + escapeHtml(formatJeDate(entry.date)) + "</td>" +
          "<td>" + escapeHtml(entry.debit.name) + "</td>" +
          '<td class="num">' + formatMoney(entry.debit.amount) + "</td>" +
          '<td class="num"></td>' +
        "</tr>" +
        '<tr class="ll-je-credit">' +
          "<td></td>" +
          '<td class="ll-je-indent">' + escapeHtml(entry.credit.name) + "</td>" +
          '<td class="num"></td>' +
          '<td class="num">' + formatMoney(entry.credit.amount) + "</td>" +
        "</tr>" +
        '<tr class="ll-je-memo">' +
          "<td></td>" +
          '<td colspan="3">' + escapeHtml(entry.narration) + "</td>" +
        "</tr>";
    }

    setText("je-total-debit", formatMoney(entry.totals.debit));
    setText("je-total-credit", formatMoney(entry.totals.credit));

    // Balance check: the difference between the two totals.
    var difference = Math.round((entry.totals.debit - entry.totals.credit) * 100) / 100;
    var check = document.getElementById("je-balance");
    if (check) {
      var balanced = entry.totals.balanced && difference === 0;
      check.className = "ll-je-check " + (balanced ? "is-balanced" : "is-unbalanced");
      check.innerHTML = balanced
        ? '<span class="ll-je-check-mark" aria-hidden="true">✓</span>' +
          "<strong>Balanced.</strong> Total debits equal total credits. " +
          '<span class="ll-je-diff">Difference: ' + formatMoney(0) + "</span>"
        : '<span class="ll-je-check-mark" aria-hidden="true">!</span>' +
          "<strong>Not balanced.</strong> Total debits and total credits differ. " +
          '<span class="ll-je-diff">Difference: ' + formatMoney(Math.abs(difference)) + "</span>";
    }

    // How This Entry Works: one sentence, then each account's type and effect.
    setText(
      "je-works-lead",
      entry.debit.name + " is debited for " + formatMoney(entry.debit.amount) + " and " +
        entry.credit.name + " is credited for " + formatMoney(entry.credit.amount) + "."
    );

    var list = document.getElementById("je-explanation-list");
    if (list) {
      list.innerHTML = entry.lines.map(function (line) {
        return (
          "<tr>" +
            '<th scope="row">' + escapeHtml(line.name) + "</th>" +
            "<td>" + escapeHtml(line.type) + "</td>" +
            "<td>" + (line.side === "debit" ? "Debit" : "Credit") + "</td>" +
            "<td>" + escapeHtml(jeEffectText(line)) + "</td>" +
          "</tr>"
        );
      }).join("");
    }

    // Contra accounts carry their own short explanation.
    var contra = document.getElementById("je-contra-note");
    if (contra) {
      var notes = entry.lines
        .filter(function (line) { return line.isContra && line.note; })
        .map(function (line) { return line.note; });
      contra.textContent = notes.join(" ");
      contra.hidden = notes.length === 0;
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

  /**
   * "Try an example" chips: choose one of the existing transactions and fill a
   * sample amount, then build the entry through the form's own submit
   * handler, exactly as Show Journal Entry does. The date keeps whatever it
   * already holds.
   */
  function initJournalExamples() {
    var form = document.getElementById("je-form");
    var select = document.getElementById("je-transaction");
    var amount = document.getElementById("je-amount");
    if (!form || !select || !amount) return;
    document.querySelectorAll(".je-example-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        select.value = button.getAttribute("data-transaction");
        amount.value = button.getAttribute("data-amount");
        clearError(select);
        clearError(amount);
        submitForm(form);
      });
    });
  }

  /** Run a tool form through its normal submit handler (used by examples). */
  function submitForm(form) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }

  /* ==========================================================
     Bank Reconciliation Helper (second Accounting Tool)
     Reads data + pure logic from bank-reconciliation.js
     (window.BankReconciliation) and renders a bank-vs-book
     reconciliation workpaper, its arithmetic, a short explanation and
     the journal entries the book-side items would require.
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

  /** A workpaper amount: "$" on each side's opening balance and on totals only. */
  function brAmount(amount, withSign) {
    var text = formatMoney(amount);
    return withSign ? text : text.replace("$", "");
  }

  /** A signed figure for an equation, with a true minus sign. */
  function brSigned(amount) {
    return formatMoney(amount).replace("-", "−");
  }

  /** One side of the workpaper: the opening balance, then each non-zero adjustment. */
  function renderBrSide(tbodyId, side, noneText) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    var html = side.lines.map(function (line) {
      if (line.sign === "start") {
        return '<tr class="ll-br-start"><th scope="row">' + escapeHtml(line.label) + "</th>" +
          '<td class="num">' + brAmount(line.amount, true) + "</td></tr>";
      }
      return '<tr class="ll-is-line"><th scope="row">' +
        '<span class="ll-doc-op">' + (line.sign === "minus" ? "−" : "+") + "</span>" +
        escapeHtml(line.label) + "</th>" +
        '<td class="num">' + brAmount(line.amount, false) + "</td></tr>";
    });
    if (side.lines.length === 1) {
      html.push('<tr class="ll-is-line is-empty"><th scope="row" colspan="2">' + noneText + "</th></tr>");
    }
    tbody.innerHTML = html.join("");
  }

  /** The adjustment of a given label on one side, or null. */
  function brLine(side, label) {
    for (var i = 1; i < side.lines.length; i++) {
      if (side.lines[i].label === label) return side.lines[i];
    }
    return null;
  }

  /** "a, b and c" */
  function brList(items) {
    if (items.length < 2) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  /** How This Was Calculated: each side's arithmetic, then the comparison. */
  function renderBrCalc(result) {
    var box = document.getElementById("br-calc");
    if (!box) return;
    var equation = function (side) {
      if (side.lines.length === 1) return formatMoney(side.adjusted) + ", with no adjustments";
      return side.lines.map(function (line, i) {
        if (i === 0) return formatMoney(line.amount);
        return (line.sign === "minus" ? "− " : "+ ") + formatMoney(line.amount);
      }).join(" ") + " = " + formatMoney(side.adjusted);
    };
    var steps = [
      {
        name: "Bank side",
        eq: equation(result.bank),
        why: "Starts from the bank statement and adjusts for items in your books that the bank " +
          "has not processed yet" + (brLine(result.bank, "Bank error") ? ", plus the bank’s error" : "") + ".",
      },
      {
        name: "Book side",
        eq: equation(result.book),
        why: "Starts from your books and adjusts for items the bank recorded that are not in " +
          "your books yet" + (brLine(result.book, "Book error") ? ", plus the error in your books" : "") + ".",
      },
      {
        name: "Difference",
        eq: formatMoney(result.bank.adjusted) + " − " + formatMoney(result.book.adjusted) +
          " = " + (result.reconciled ? formatMoney(0) : brSigned(result.difference)),
        why: result.reconciled
          ? "The adjusted balances agree, so the cash is reconciled."
          : "The cash is reconciled only when the adjusted balances agree. These are " +
            formatMoney(Math.abs(result.difference)) + " apart.",
      },
    ];
    box.innerHTML = steps.map(function (s) {
      return '<div class="ll-tool-step">' +
        '<p class="ll-tool-step-name">' + s.name + "</p>" +
        '<p class="ll-tool-step-eq">' + s.eq + "</p>" +
        '<p class="ll-tool-step-why">' + s.why + "</p>" +
        "</div>";
    }).join("");
  }

  /** What This Means: sentences read from the finished workpaper. */
  function brMeaningNotes(result) {
    var notes = [];
    var bank = result.bank, book = result.book;
    var hasItems = bank.lines.length > 1 || book.lines.length > 1;
    var gap = formatMoney(Math.abs(result.difference));

    if (!result.reconciled) {
      var bankLower = result.difference < 0;
      notes.push("After the reconciling items, the adjusted bank balance (" + formatMoney(bank.adjusted) +
        ") is " + gap + (bankLower ? " lower" : " higher") + " than the adjusted book balance (" +
        formatMoney(book.adjusted) + "). No item entered explains that " + gap + ".");
      notes.push(bankLower
        ? "The bank side is the lower one. A deposit in transit that is not listed, a bank error, " +
          "or an unrecorded fee or error on the book side would explain a gap in this direction."
        : "The bank side is the higher one. An outstanding check that is not listed, a bank error, " +
          "or unrecorded interest or an error on the book side would explain a gap in this direction.");
      var cents = Math.round(Math.abs(result.difference) * 100);
      if (cents % 9 === 0) {
        notes.push(gap + " divides evenly by 9, which often means two digits were swapped " +
          "when an amount was copied.");
      }
      return notes;
    }

    notes.push(hasItems
      ? "After the reconciling items, the bank’s records and your books agree: both show " +
        formatMoney(bank.adjusted) + " of cash."
      : "The bank statement and your books already show the same balance, " +
        formatMoney(bank.adjusted) + ", so no reconciling items were needed.");

    var deposits = brLine(bank, "Deposits in transit");
    var checks = brLine(bank, "Outstanding checks");
    if (deposits && checks) {
      notes.push("The " + formatMoney(deposits.amount) + " of deposits in transit and " +
        formatMoney(checks.amount) + " of outstanding checks are timing differences. " +
        "They clear once the bank processes them.");
    } else if (deposits) {
      notes.push("The " + formatMoney(deposits.amount) + " of deposits in transit is a timing " +
        "difference. It clears once the bank records the deposit.");
    } else if (checks) {
      notes.push("The " + formatMoney(checks.amount) + " of outstanding checks is a timing " +
        "difference. It clears once the checks are cashed.");
    }

    var bookItems = [];
    var fees = brLine(book, "Bank service fees");
    var interest = brLine(book, "Interest earned");
    var bookError = brLine(book, "Book error");
    if (fees) bookItems.push(formatMoney(fees.amount) + " of bank service fees");
    if (interest) bookItems.push(formatMoney(interest.amount) + " of interest earned");
    if (bookError) bookItems.push("the " + formatMoney(bookError.amount) + " correction for the book error");
    if (bookItems.length) {
      notes.push("Your books do not yet show " + brList(bookItems) + ". Recording the journal " +
        (bookItems.length > 1 ? "entries" : "entry") + " below brings the book balance to " +
        formatMoney(book.adjusted) + ".");
    }

    var bankError = brLine(bank, "Bank error");
    if (bankError) {
      notes.push("The " + formatMoney(bankError.amount) + " bank error is the bank’s to correct. " +
        "It needs no entry in your books.");
    }
    return notes;
  }

  /** Journal Entries to Record: the book-side entries, then the bank-side items that need none. */
  function renderBrEntries(inputs, result) {
    var entries = window.BankReconciliation.suggestedEntries(inputs);
    var needed = entries.filter(function (e) { return e.needsEntry; });
    var hasItems = result.bank.lines.length > 1 || result.book.lines.length > 1;

    var lead = document.getElementById("br-entries-lead");
    if (lead) {
      lead.textContent = needed.length
        ? "Only the book-side items need journal entries. They update your books for what the bank already recorded."
        : hasItems
          ? "No journal entries are needed. Every reconciling item is on the bank side."
          : "No reconciling items were entered, so there is nothing to record.";
    }

    var memo = {
      "Bank service fees": "To record bank service fees.",
      "Interest earned": "To record interest earned.",
      "Book error": "To correct the error in the books.",
    };
    var rows = document.getElementById("br-entries-rows");
    if (rows) {
      rows.innerHTML = needed.map(function (e) {
        return '<tr class="ll-entry-debit"><th scope="row">' + escapeHtml(e.debit) + "</th>" +
            '<td class="num">' + formatMoney(e.amount) + '</td><td class="num"></td></tr>' +
          '<tr class="ll-entry-credit"><th scope="row" class="ll-entry-indent">' + escapeHtml(e.credit) + "</th>" +
            '<td class="num"></td><td class="num">' + formatMoney(e.amount) + "</td></tr>" +
          '<tr class="ll-entry-memo"><td colspan="3">' + escapeHtml(memo[e.item] || e.item) + "</td></tr>";
      }).join("");
    }
    var wrap = document.getElementById("br-entries-wrap");
    if (wrap) wrap.hidden = needed.length === 0;

    var foot = document.getElementById("br-entries-foot");
    if (foot) {
      var notes = [];
      var timing = [];
      if (brLine(result.bank, "Deposits in transit")) timing.push("deposits in transit");
      if (brLine(result.bank, "Outstanding checks")) timing.push("outstanding checks");
      if (timing.length) {
        notes.push("No entry for " + timing.join(" or ") + ": they clear when the bank processes them.");
      }
      if (brLine(result.bank, "Bank error")) notes.push("No entry for the bank error: the bank corrects it.");
      foot.textContent = notes.join(" ");
      foot.hidden = notes.length === 0;
    }
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

    // Status: the answer first, from the module's own reconciled flag.
    var status = document.getElementById("br-status");
    if (status) {
      status.classList.remove("is-pos", "is-neg", "is-zero");
      status.classList.add(result.reconciled ? "is-pos" : "is-neg");
    }
    setText("br-status-label", result.reconciled ? "Reconciled" : "Not reconciled");
    setText("br-status-detail", result.reconciled
      ? "Adjusted bank and book balances both equal " + formatMoney(result.bank.adjusted)
      : "Difference of " + formatMoney(Math.abs(result.difference)) + " between the adjusted balances");

    // The workpaper: each side brought to its adjusted balance, then the difference.
    renderBrSide("br-bank-rows", result.bank, "No bank-side items");
    renderBrSide("br-book-rows", result.book, "No book-side items");
    setText("br-bank-adjusted", formatMoney(result.bank.adjusted));
    setText("br-book-adjusted", formatMoney(result.book.adjusted));
    setText("br-difference", result.reconciled ? formatMoney(0) : formatMoney(Math.abs(result.difference)));
    var diffLine = document.getElementById("br-diff-line");
    if (diffLine) {
      diffLine.classList.toggle("is-income", result.reconciled);
      diffLine.classList.toggle("is-loss", !result.reconciled);
    }

    renderBrCalc(result);

    var list = document.getElementById("br-meaning-list");
    if (list) {
      list.innerHTML = "";
      brMeaningNotes(result).forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
    }

    renderBrEntries(inputs, result);
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
     and renders an asset depreciation schedule, the formula with the
     user's numbers, the yearly journal entry and a short explanation.
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

  /** "1 year" / "5 years" */
  function depYears(n) {
    return n + (n === 1 ? " year" : " years");
  }

  /** Render the depreciation result as an asset schedule. */
  function renderDepreciation(result) {
    var empty = document.getElementById("dep-empty");
    var dashboard = document.getElementById("dep-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    var life = result.usefulLife;
    var schedule = result.schedule;
    var last = schedule[schedule.length - 1];
    var trueUp = life > 1 && last.expense !== result.annual;

    // Asset summary and the headline figure.
    setText("dep-title", result.name.trim() || "Asset");
    setText("dep-fact-method", result.method);
    setText("dep-fact-cost", formatMoney(result.cost));
    setText("dep-fact-salvage", formatMoney(result.salvage));
    setText("dep-fact-life", depYears(life));
    setText("dep-out-annual", formatMoney(result.annual));
    setText("dep-out-monthly", formatMoney(result.monthly) + " per month");

    // Schedule: the asset at cost, then one row per year down to salvage.
    var rows = document.getElementById("dep-schedule-rows");
    if (rows) {
      var bar = function (bookValue) {
        var pct = result.cost > 0 ? Math.max(0, Math.min(100, (bookValue / result.cost) * 100)) : 0;
        return '<td class="ll-dep-barcell" aria-hidden="true"><span class="ll-dep-bar">' +
          '<span style="width:' + pct.toFixed(1) + '%"></span></span></td>';
      };
      // Accumulated depreciation builds each year: a red up arrow, the same red
      // as the book-value cue, since it is what pulls book value down.
      var accumulatedCue = '<span class="ll-move ll-move--up ll-move--accent" aria-hidden="true">' +
        '<svg viewBox="0 0 12 12" focusable="false"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" /></svg></span>';
      rows.innerHTML =
        '<tr class="ll-dep-start"><th scope="row">At purchase</th><td class="num"></td><td class="num"></td>' +
          '<td class="num">' + formatMoney(result.cost) + "</td>" + bar(result.cost) + "</tr>" +
        schedule.map(function (row, i) {
          // "$" on the first year and the total only, as on a statement.
          var money = function (n) { return i === 0 ? formatMoney(n) : formatMoney(n).replace("$", ""); };
          return '<tr><th scope="row"><span class="ll-dep-yr">Year </span>' + row.year + "</th>" +
            '<td class="num">' + money(row.expense) + "</td>" +
            '<td class="num">' + accumulatedCue + money(row.accumulated) + "</td>" +
            '<td class="num">' + money(row.bookValue) + "</td>" + bar(row.bookValue) + "</tr>";
        }).join("");
    }
    setText("dep-total-expense", formatMoney(last.accumulated));

    var note = document.getElementById("dep-trueup-note");
    if (note) {
      note.textContent = trueUp
        ? "Year " + life + " is " + formatMoney(last.expense) + " rather than " +
          formatMoney(result.annual) + ". The final year takes the rounding difference so book " +
          "value ends exactly at the " + formatMoney(result.salvage) + " salvage value."
        : "";
      note.hidden = !trueUp;
    }

    // How This Was Calculated: the straight-line formula with these numbers.
    setText("dep-calc-cost", formatMoney(result.cost));
    setText("dep-calc-salvage", formatMoney(result.salvage));
    setText("dep-calc-base", formatMoney(result.depreciableBase));
    setText("dep-calc-life", depYears(life));
    setText("dep-calc-annual", formatMoney(result.annual));
    setText("dep-calc-monthly", formatMoney(result.monthly));

    // The entry recorded each year.
    setText("dep-je-debit-account", result.journal.debit);
    setText("dep-je-credit-account", result.journal.credit);
    setText("dep-je-debit", formatMoney(result.journal.amount));
    setText("dep-je-credit", formatMoney(result.journal.amount));
    setText("dep-je-foot", life === 1
      ? "Recorded at the end of the year."
      : trueUp
        ? "Recorded at the end of each year. The year " + life + " entry is " + formatMoney(last.expense) + "."
        : "Recorded at the end of each of the " + life + " years.");

    // What This Means
    var list = document.getElementById("dep-meaning-list");
    if (list) {
      list.innerHTML = "";
      var notes = [
        "The depreciable base is " + formatMoney(result.depreciableBase) + ": the " +
          formatMoney(result.cost) + " cost minus the " + formatMoney(result.salvage) + " salvage value. " +
          (life === 1
            ? "With a useful life of 1 year, all of it is depreciation expense in that year."
            : "Spread evenly over " + life + " years, that is " + formatMoney(result.annual) +
              " of depreciation expense each year."),
        "Each year’s expense adds to accumulated depreciation, so book value falls from " +
          formatMoney(result.cost) + " to " + formatMoney(last.bookValue) + " by the end of year " + life + ".",
        "Book value is an accounting figure: cost minus accumulated depreciation. It is not a " +
          "measure of what the asset could be sold for.",
        "Depreciation expense lowers net income each year, but no cash is paid when it is recorded.",
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

    // Example boxes: fill the form fields with the example's values, then
    // calculate through the form's own submit handler, as Calculate does.
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
        submitForm(form);
      });
    });
  }

  /* ==========================================================
     Income Statement Builder (fourth Accounting Tool)
     Reads pure logic from income-statement.js
     (window.IncomeStatement). Single-step: revenue - expenses.
     ========================================================== */

  var IS_FIXED_FIELDS = [
    "is-revenue", "is-rent", "is-wages", "is-supplies",
    "is-utilities", "is-depreciation", "is-other",
  ];

  // Preset scenarios for the compact example buttons (realistic sample numbers).
  var IS_EXAMPLES = {
    coffee: {
      name: "Sunrise Coffee", period: "June 2026", revenue: "18000",
      rent: "3500", wages: "6000", supplies: "2200",
      utilities: "700", depreciation: "500", other: "600",
    },
    tutoring: {
      name: "BrightPath Tutoring", period: "June 2026", revenue: "9500",
      rent: "1200", wages: "3000", supplies: "400",
      utilities: "250", depreciation: "150", other: "300",
    },
    clothing: {
      name: "Urban Thread", period: "June 2026", revenue: "26000",
      rent: "4500", wages: "7500", supplies: "6000",
      utilities: "900", depreciation: "700", other: "1200",
    },
  };

  function isValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  // Apply the same money sanitizing initMoneyInputs() uses, for inputs added
  // dynamically after page load (custom rows).
  function attachMoneySanitizer(input) {
    var blockedKeys = ["e", "E", "+", "-"];
    input.addEventListener("keydown", function (event) {
      if (blockedKeys.indexOf(event.key) !== -1) event.preventDefault();
    });
    input.addEventListener("input", function () {
      var cleaned = input.value.replace(/[^0-9.]/g, "");
      var firstDot = cleaned.indexOf(".");
      if (firstDot !== -1) {
        cleaned = cleaned.slice(0, firstDot + 1) +
          cleaned.slice(firstDot + 1).replace(/\./g, "");
      }
      if (cleaned !== input.value) input.value = cleaned;
    });
  }

  // Build one custom row (label + amount + remove). `kind` is "revenue"|"expense".
  function isAddCustomRow(kind) {
    var container = document.getElementById(
      kind === "revenue" ? "is-custom-revenue" : "is-custom-expenses"
    );
    if (!container) return;
    var row = document.createElement("div");
    row.className = "is-row field"; // .field so showError/clearError can attach
    var placeholder = kind === "revenue" ? "e.g. Interest income" : "e.g. Marketing";
    row.innerHTML =
      '<input type="text" class="is-row-label" placeholder="' + placeholder + '" autocomplete="off" />' +
      '<div class="money-input is-row-amount">' +
        '<span class="money-symbol">$</span>' +
        '<input type="number" class="is-row-amount-input" min="0" step="0.01" inputmode="decimal" placeholder="0" />' +
      "</div>" +
      '<button type="button" class="is-row-remove" aria-label="Remove row">✕</button>';
    container.appendChild(row);
    attachMoneySanitizer(row.querySelector(".is-row-amount-input"));
    row.querySelector(".is-row-remove").addEventListener("click", function () {
      row.parentNode.removeChild(row);
    });
  }

  // Collect { label, amount } from a custom-row container.
  function isCollectRows(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return [];
    var rows = [];
    container.querySelectorAll(".is-row").forEach(function (row) {
      var label = (row.querySelector(".is-row-label").value || "").trim();
      var amount = row.querySelector(".is-row-amount-input").value;
      rows.push({ label: label, amount: amount, _row: row });
    });
    return rows;
  }

  // Validate: fixed money fields >= 0; custom rows need both label and amount
  // (or be fully blank). Returns true when valid.
  function validateIncomeStatement() {
    var ok = true;
    var firstInvalid = null;

    IS_FIXED_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      var raw = (input.value || "").trim();
      if (raw === "") { clearError(input); return; }
      var n = Number(raw);
      if (isNaN(n) || !isFinite(n) || n < 0) {
        showError(input, "Enter 0 or more.");
        ok = false;
        if (!firstInvalid) firstInvalid = input;
      } else {
        clearError(input);
      }
    });

    ["is-custom-revenue", "is-custom-expenses"].forEach(function (cid) {
      isCollectRows(cid).forEach(function (r) {
        var labelInput = r._row.querySelector(".is-row-label");
        var hasLabel = r.label !== "";
        var hasAmount = (r.amount || "").trim() !== "" && Number(r.amount) > 0;
        if (hasLabel !== hasAmount) {
          showError(labelInput, "Add both a name and an amount, or remove the row.");
          ok = false;
          if (!firstInvalid) firstInvalid = labelInput;
        } else {
          clearError(labelInput);
        }
      });
    });

    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  /** A statement amount: "$" on the first line of a column and on totals only. */
  function isStatementMoney(amount, withSign) {
    var text = formatMoney(amount);
    return withSign ? text : text.replace("$", "");
  }

  /** Net figure as the statement shows it: a loss in parentheses. */
  function isNetText(result) {
    return result.isLoss
      ? "(" + formatMoney(Math.abs(result.netIncome)) + ")"
      : formatMoney(result.netIncome);
  }

  /** Statement rows for one section; shows a single $0.00 line when empty. */
  function isStatementRows(lines, emptyText) {
    if (lines.length === 0) {
      return '<tr class="ll-is-line is-empty"><th scope="row">' + emptyText + "</th>" +
        '<td class="num">' + formatMoney(0) + "</td></tr>";
    }
    return lines.map(function (l, i) {
      return '<tr class="ll-is-line"><th scope="row">' + escapeHtml(l.label) + "</th>" +
        '<td class="num">' + isStatementMoney(l.amount, i === 0) + "</td></tr>";
    }).join("");
  }

  /** Sentences for "What This Means", read from the finished statement. */
  function isMeaningNotes(result, expenseLines) {
    var notes = [];
    var period = result.period.trim();
    var during = period ? " for " + period : " for the period";
    var net = result.netIncome;

    if (net > 0 && result.totalExpenses > 0) {
      notes.push("Revenue was higher than expenses" + during + ", so the business earned net income.");
    } else if (net > 0) {
      notes.push("No expenses were recorded" + during + ", so all of the revenue is net income.");
    } else if (net < 0 && result.totalRevenue > 0) {
      notes.push("Expenses were higher than revenue" + during + ", so the business recorded a net loss.");
    } else if (net < 0) {
      notes.push("No revenue was recorded" + during + ", so the expenses become a net loss of the same amount.");
    } else {
      notes.push("Revenue exactly covered expenses" + during + ", so the business broke even, with no net income or net loss.");
    }

    var le = result.largestExpense;
    if (le && expenseLines.length > 1) {
      notes.push(le.label + " is the largest expense" +
        (le.pctOfRevenue !== null ? ", equal to " + Math.round(le.pctOfRevenue * 100) + "% of revenue" : "") + ".");
    } else if (le) {
      notes.push(le.label + " is the only expense on the statement.");
    }

    if (result.hasDepreciation) {
      notes.push("Depreciation expense lowers net income, but it is not a cash payment this period. " +
        "It spreads the cost of a long-term asset over its useful life.");
    }
    return notes;
  }

  function renderIncomeStatement(result) {
    var empty = document.getElementById("is-empty");
    var dashboard = document.getElementById("is-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    var setLine = function (id, text) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.hidden = text === "";
    };

    // Heading: entity, statement name, period.
    var name = result.name.trim();
    var period = result.period.trim();
    setLine("is-entity", name);
    setLine("is-period-line", period ? "For " + period : "");

    // Status: net income / net loss / break-even, coloured by sign.
    var net = result.netIncome;
    var status = document.getElementById("is-status");
    if (status) {
      status.classList.remove("is-pos", "is-neg", "is-zero");
      status.classList.add(net > 0 ? "is-pos" : net < 0 ? "is-neg" : "is-zero");
    }
    setText("is-status-label", net > 0 ? "Net income" : net < 0 ? "Net loss" : "Break-even");
    setText("is-status-detail", net > 0 && result.margin !== null
      ? Math.round(result.margin * 100) + "% of revenue kept as net income"
      : "");

    // The statement. Expense lines with no amount are left off, as on a
    // finished statement; their $0 does not change any total.
    var expenseLines = result.expenseLines.filter(function (l) { return l.amount > 0; });
    var revBody = document.getElementById("is-statement-revenue");
    if (revBody) revBody.innerHTML = isStatementRows(result.revenueLines, "No revenue entered");
    var expBody = document.getElementById("is-statement-expenses");
    if (expBody) expBody.innerHTML = isStatementRows(expenseLines, "No expenses entered");
    setText("is-total-revenue", formatMoney(result.totalRevenue));
    setText("is-total-expenses", formatMoney(result.totalExpenses));

    var netLabel = result.isLoss ? "Net loss" : "Net income";
    setText("is-net-line-label", netLabel);
    setText("is-net-line-amount", isNetText(result));
    var netLine = document.getElementById("is-net-line");
    if (netLine) {
      netLine.classList.toggle("is-loss", result.isLoss);
      netLine.classList.toggle("is-income", net > 0);
    }

    // How This Was Calculated: the three totals only.
    setText("is-calc-revenue", formatMoney(result.totalRevenue));
    setText("is-calc-expenses", formatMoney(result.totalExpenses));
    setText("is-calc-net-label", netLabel);
    setText("is-calc-net", isNetText(result));
    var calcNet = document.getElementById("is-calc-net");
    if (calcNet) {
      calcNet.classList.toggle("is-pos", net > 0);
      calcNet.classList.toggle("is-neg", net < 0);
    }

    var list = document.getElementById("is-explanation-list");
    if (list) {
      list.innerHTML = "";
      isMeaningNotes(result, expenseLines).forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
    }
  }

  function resetIncomeStatement() {
    IS_FIXED_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (input) { input.value = ""; clearError(input); }
    });
    ["is-name", "is-period"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.value = "";
    });
    ["is-custom-revenue", "is-custom-expenses"].forEach(function (id) {
      var c = document.getElementById(id);
      if (c) c.innerHTML = "";
    });
    var empty = document.getElementById("is-empty");
    var dashboard = document.getElementById("is-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initIncomeStatement() {
    var form = document.getElementById("is-form");
    if (!form) return;
    if (!window.IncomeStatement) return;

    var addRev = document.getElementById("is-add-revenue");
    var addExp = document.getElementById("is-add-expense");
    if (addRev) addRev.addEventListener("click", function () { isAddCustomRow("revenue"); });
    if (addExp) addExp.addEventListener("click", function () { isAddCustomRow("expense"); });

    // Example buttons: reset the form, fill the preset values, then build.
    function applyIsExample(key) {
      var ex = IS_EXAMPLES[key];
      if (!ex) return;
      resetIncomeStatement();
      var setVal = function (id, value) {
        var el = document.getElementById(id);
        if (el) { el.value = value; clearError(el); }
      };
      setVal("is-name", ex.name);
      setVal("is-period", ex.period);
      setVal("is-revenue", ex.revenue);
      setVal("is-rent", ex.rent);
      setVal("is-wages", ex.wages);
      setVal("is-supplies", ex.supplies);
      setVal("is-utilities", ex.utilities);
      setVal("is-depreciation", ex.depreciation);
      setVal("is-other", ex.other);
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
    document.querySelectorAll(".is-example-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        applyIsExample(button.getAttribute("data-example"));
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateIncomeStatement()) return;
      var result = window.IncomeStatement.buildIncomeStatement({
        name: isValue("is-name"),
        period: isValue("is-period"),
        revenue: isValue("is-revenue"),
        rent: isValue("is-rent"),
        wages: isValue("is-wages"),
        supplies: isValue("is-supplies"),
        utilities: isValue("is-utilities"),
        depreciation: isValue("is-depreciation"),
        other: isValue("is-other"),
        customRevenue: isCollectRows("is-custom-revenue"),
        customExpenses: isCollectRows("is-custom-expenses"),
      });
      if (result) {
        renderIncomeStatement(result);
      } else {
        // Nothing entered: keep the empty state, nudge the revenue field.
        var rev = document.getElementById("is-revenue");
        if (rev) showError(rev, "Enter some revenue or expenses to build a statement.");
      }
    });

    form.addEventListener("reset", function () {
      window.setTimeout(resetIncomeStatement, 0);
    });
  }

  /* ==========================================================
     Cash Flow Helper (fifth Accounting Tool)
     Reads pure logic from cash-flow.js (window.CashFlow).
     Simplified direct method: transactions -> 3 activity sections.
     ========================================================== */

  var CF_EXAMPLES = {
    healthy: { name: "Bluebird Cafe", period: "June 2026", beginning: "4000", rows: [
      { type: "cust", amount: "20000" }, { type: "rent", amount: "3500" },
      { type: "wages", amount: "7000" }, { type: "buy-equip", amount: "5000" },
      { type: "loan-principal", amount: "1000" },
    ]},
    startup: { name: "Nimbus Labs", period: "June 2026", beginning: "1000", rows: [
      { type: "cust", amount: "2000" }, { type: "rent", amount: "1500" },
      { type: "wages", amount: "4000" }, { type: "buy-equip", amount: "3000" },
      { type: "owner-invest", amount: "5000" }, { type: "loan-proceeds", amount: "4000" },
    ]},
    upgrade: { name: "Ridgeline Goods", period: "June 2026", beginning: "8000", rows: [
      { type: "cust", amount: "15000" }, { type: "rent", amount: "3000" },
      { type: "wages", amount: "5000" }, { type: "buy-equip", amount: "9000" },
      { type: "sell-equip", amount: "1000" }, { type: "owner-withdraw", amount: "2000" },
    ]},
  };

  function cfValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  // Build one transaction row: catalog <select> (grouped) + amount + remove.
  function cfAddRow(presetType, presetAmount) {
    var container = document.getElementById("cf-transactions");
    if (!container || !window.CashFlow) return;
    var row = document.createElement("div");
    row.className = "cf-row field"; // .field so showError/clearError can attach

    var groups = { operating: "Operating", investing: "Investing", financing: "Financing" };
    var optsByGroup = { operating: "", investing: "", financing: "" };
    window.CashFlow.CATALOG.forEach(function (c) {
      optsByGroup[c.category] +=
        '<option value="' + c.id + '">' + escapeHtml(c.label) + "</option>";
    });
    var selectHtml = '<select class="cf-row-select"><option value="">Choose a transaction…</option>';
    ["operating", "investing", "financing"].forEach(function (g) {
      selectHtml += '<optgroup label="' + groups[g] + '">' + optsByGroup[g] + "</optgroup>";
    });
    selectHtml += "</select>";

    row.innerHTML =
      selectHtml +
      '<div class="money-input is-row-amount">' +
        '<span class="money-symbol">$</span>' +
        '<input type="number" class="cf-row-amount-input" min="0" step="0.01" inputmode="decimal" placeholder="0" />' +
      "</div>" +
      '<button type="button" class="is-row-remove" aria-label="Remove row">✕</button>';
    container.appendChild(row);
    attachMoneySanitizer(row.querySelector(".cf-row-amount-input"));
    row.querySelector(".is-row-remove").addEventListener("click", function () {
      row.parentNode.removeChild(row);
    });
    if (presetType) row.querySelector(".cf-row-select").value = presetType;
    if (presetAmount != null) row.querySelector(".cf-row-amount-input").value = presetAmount;
    return row;
  }

  // Collect { type, amount } from the transaction rows (with _row ref for errors).
  function cfCollectRows() {
    var container = document.getElementById("cf-transactions");
    if (!container) return [];
    var rows = [];
    container.querySelectorAll(".cf-row").forEach(function (row) {
      rows.push({
        type: row.querySelector(".cf-row-select").value,
        amount: row.querySelector(".cf-row-amount-input").value,
        _row: row,
      });
    });
    return rows;
  }

  // Beginning cash >= 0; each row must have both a type and amount>0, or be fully blank.
  function validateCashFlow() {
    var ok = true, firstInvalid = null;
    var begin = document.getElementById("cf-beginning");
    if (begin) {
      var raw = (begin.value || "").trim();
      if (raw !== "" && (isNaN(Number(raw)) || !isFinite(Number(raw)) || Number(raw) < 0)) {
        showError(begin, "Enter 0 or more."); ok = false; firstInvalid = begin;
      } else { clearError(begin); }
    }
    cfCollectRows().forEach(function (r) {
      var sel = r._row.querySelector(".cf-row-select");
      var hasType = r.type !== "";
      var hasAmount = (r.amount || "").trim() !== "" && Number(r.amount) > 0;
      if (hasType !== hasAmount) {
        showError(sel, "Pick a transaction and enter an amount, or remove the row.");
        ok = false; if (!firstInvalid) firstInvalid = sel;
      } else { clearError(sel); }
    });
    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  /**
   * Movement cue: a small up or down arrow for a meaningful change, or ""
   * for none. Decorative (aria-hidden): the words beside it state the direction.
   */
  function moveCue(value) {
    if (!value) return "";
    return '<span class="ll-move ll-move--' + (value > 0 ? "up" : "down") + '" aria-hidden="true">' +
      '<svg viewBox="0 0 12 12" focusable="false"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" /></svg></span>';
  }

  /** A statement amount: outflows in parentheses; "$" only where withSign is set. */
  function cfMoney(amount, withSign) {
    var text = formatMoney(Math.abs(amount));
    if (!withSign) text = text.replace("$", "");
    return amount < 0 ? "(" + text + ")" : text;
  }

  /** One activity section: each line, "$" on the first; a note when empty. */
  function cfRenderSection(bodyId, lines) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    if (lines.length === 0) {
      body.innerHTML = '<tr class="ll-is-line is-empty"><th scope="row" colspan="2">None this period</th></tr>';
      return;
    }
    body.innerHTML = lines.map(function (l, i) {
      return '<tr class="ll-is-line"><th scope="row">' + escapeHtml(l.label) + "</th>" +
        '<td class="num">' + cfMoney(l.amount, i === 0) + "</td></tr>";
    }).join("");
  }

  /** "operating activities", "operating and financing activities", ... */
  function cfNames(groups) {
    var names = groups.map(function (g) { return g.key; });
    var joined = names.length < 2 ? names.join("")
      : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    return joined + " activities";
  }

  function cfCap(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** What This Means: where the cash came from and where it went. */
  function cfMeaningNotes(result) {
    var notes = [];
    var groups = ["operating", "investing", "financing"].map(function (k) {
      return { key: k, value: result[k].subtotal };
    });
    var providers = groups.filter(function (g) { return g.value > 0; });
    var users = groups.filter(function (g) { return g.value < 0; });
    var sum = function (gs) { return gs.reduce(function (s, g) { return s + Math.abs(g.value); }, 0); };
    var provided = sum(providers), used = sum(users);
    var net = result.netChange;
    var change = formatMoney(Math.abs(net));
    var each = function (gs, verb) {
      return gs.map(function (g) { return g.key + " activities " + verb + " " + formatMoney(Math.abs(g.value)); });
    };
    var andList = function (items) {
      return items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
    };

    if (providers.length && users.length) {
      if (net > 0) {
        notes.push("Cash increased by " + change + " because the " + formatMoney(provided) + " provided by " +
          cfNames(providers) + " was more than the " + formatMoney(used) + " used by " + cfNames(users) + ".");
      } else if (net < 0) {
        notes.push("Cash decreased by " + change + " because the " + formatMoney(used) + " used by " +
          cfNames(users) + " was more than the " + formatMoney(provided) + " provided by " + cfNames(providers) + ".");
      } else {
        notes.push("The " + formatMoney(provided) + " provided by " + cfNames(providers) +
          " exactly matched the " + formatMoney(used) + " used by " + cfNames(users) +
          ", so cash ended the period where it started.");
      }
      // Name the main driver when several activities pushed the same way.
      var side = net > 0 ? providers : net < 0 ? users : [];
      var total = net > 0 ? provided : used;
      var top = side.slice().sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); })[0];
      if (side.length > 1 && Math.abs(top.value) > total / 2) {
        notes.push(cfCap(top.key) + " activities accounted for most of the cash " +
          (net > 0 ? "coming in" : "going out") + ": " + formatMoney(Math.abs(top.value)) +
          " of the " + formatMoney(total) + ".");
      }
    } else if (providers.length) {
      notes.push(providers.length === 1
        ? "Cash increased by " + change + ", all of it from " + cfNames(providers) + "."
        : "Cash increased by " + change + ": " + andList(each(providers, "provided")) + ".");
    } else if (users.length) {
      notes.push(users.length === 1
        ? "Cash decreased by " + change + ", all of it used by " + cfNames(users) + "."
        : "Cash decreased by " + change + ": " + andList(each(users, "used")) + ".");
    } else {
      notes.push("The cash coming in and going out cancelled out within each activity, so cash did not change.");
    }

    if (result.flags.reliedOnFinancing) {
      notes.push("Day-to-day operations used " + formatMoney(Math.abs(result.operating.subtotal)) +
        " this period, so the cash came from owners or lenders rather than from running the business.");
    }

    var sumLines = function (lines, label) {
      return lines.reduce(function (s, l) { return l.label === label ? s + Math.abs(l.amount) : s; }, 0);
    };
    if (result.flags.hasEquipmentPurchase) {
      notes.push("Buying equipment used " + formatMoney(sumLines(result.investing.lines, "Bought equipment")) +
        " of cash, but it is not an expense on the income statement this period. That is one reason cash and profit differ.");
    }
    if (result.flags.hasOwnerInvestment) {
      notes.push("The owner’s " + formatMoney(sumLines(result.financing.lines, "Owner invested cash")) +
        " investment raised cash through financing activities. It is not revenue, so it does not add to profit.");
    }
    if (result.endingCash < 0) {
      notes.push("Ending cash is below zero. A business cannot pay out cash it does not have, so this " +
        "points to an overdraft, or a beginning balance or inflow that was not entered.");
    }
    return notes;
  }

  function renderCashFlow(result) {
    var empty = document.getElementById("cf-empty");
    var dashboard = document.getElementById("cf-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    var setLine = function (id, text) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.hidden = text === "";
    };
    var sign = function (el, value) {
      if (!el) return;
      el.classList.toggle("is-pos", value > 0);
      el.classList.toggle("is-neg", value < 0);
    };

    var net = result.netChange;
    var netLabel = net > 0 ? "Net increase in cash" : net < 0 ? "Net decrease in cash" : "Net change in cash";

    // Status: what happened to cash, in neutral terms. An arrow replaces the
    // dot when cash moved; no change keeps the neutral dot.
    var status = document.getElementById("cf-status");
    if (status) {
      status.classList.remove("is-pos", "is-neg", "is-zero");
      status.classList.add(net > 0 ? "is-pos" : net < 0 ? "is-neg" : "is-zero");
      status.classList.toggle("has-move", net !== 0);
    }
    var statusMove = document.getElementById("cf-status-move");
    if (statusMove) {
      statusMove.outerHTML = net
        ? moveCue(net).replace('class="ll-move', 'id="cf-status-move" class="ll-move')
        : '<span class="ll-move" id="cf-status-move" aria-hidden="true" hidden></span>';
    }
    setText("cf-status-label", net > 0 ? "Cash increased" : net < 0 ? "Cash decreased" : "No net change in cash");
    setText("cf-status-detail", net === 0
      ? "Cash stayed at " + cfMoney(result.beginningCash, true)
      : (net > 0 ? "Up " : "Down ") + formatMoney(Math.abs(net)) + ", from " +
        cfMoney(result.beginningCash, true) + " to " + cfMoney(result.endingCash, true));

    // Heading: entity, statement name, period.
    var name = result.name.trim();
    var period = result.period.trim();
    setLine("cf-entity", name);
    setLine("cf-period-line", period ? "For " + period : "");

    // Statement sections + subtotals
    cfRenderSection("cf-stmt-operating", result.operating.lines);
    cfRenderSection("cf-stmt-investing", result.investing.lines);
    cfRenderSection("cf-stmt-financing", result.financing.lines);
    setText("cf-sub-operating", cfMoney(result.operating.subtotal, true));
    setText("cf-sub-investing", cfMoney(result.investing.subtotal, true));
    setText("cf-sub-financing", cfMoney(result.financing.subtotal, true));

    // Net change, then beginning to ending cash.
    setText("cf-net-label", netLabel);
    var netAmount = document.getElementById("cf-net-line-amount");
    if (netAmount) netAmount.innerHTML = moveCue(net) + cfMoney(net, true);
    sign(document.getElementById("cf-net-line"), net);
    setText("cf-begin-line", cfMoney(result.beginningCash, true));
    setText("cf-end-line", cfMoney(result.endingCash, true));
    var endRow = document.getElementById("cf-end-row");
    if (endRow) endRow.classList.toggle("is-loss", result.endingCash < 0);

    // How This Was Calculated
    setText("cf-calc-operating", cfMoney(result.operating.subtotal, true));
    setText("cf-calc-investing", cfMoney(result.investing.subtotal, true));
    setText("cf-calc-financing", cfMoney(result.financing.subtotal, true));
    setText("cf-calc-net-label", netLabel);
    setText("cf-calc-net", cfMoney(net, true));
    sign(document.getElementById("cf-calc-net"), net);
    setText("cf-calc-begin", cfMoney(result.beginningCash, true));
    setText("cf-calc-end", cfMoney(result.endingCash, true));
    var calcEnd = document.getElementById("cf-calc-end");
    if (calcEnd) calcEnd.classList.toggle("is-neg", result.endingCash < 0);

    var list = document.getElementById("cf-meaning-list");
    if (list) {
      list.innerHTML = "";
      cfMeaningNotes(result).forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
    }
  }

  function resetCashFlow() {
    ["cf-name", "cf-period"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });
    var begin = document.getElementById("cf-beginning");
    if (begin) { begin.value = ""; clearError(begin); }
    var c = document.getElementById("cf-transactions");
    if (c) c.innerHTML = "";
    var empty = document.getElementById("cf-empty");
    var dashboard = document.getElementById("cf-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initCashFlow() {
    var form = document.getElementById("cf-form");
    if (!form || !window.CashFlow) return;

    var add = document.getElementById("cf-add");
    if (add) add.addEventListener("click", function () { cfAddRow(); });

    function applyCfExample(key) {
      var ex = CF_EXAMPLES[key];
      if (!ex) return;
      resetCashFlow();
      var setVal = function (id, value) {
        var el = document.getElementById(id); if (el) { el.value = value; clearError(el); }
      };
      setVal("cf-name", ex.name);
      setVal("cf-period", ex.period);
      setVal("cf-beginning", ex.beginning);
      ex.rows.forEach(function (r) { cfAddRow(r.type, r.amount); });
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
    document.querySelectorAll(".cf-example-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        applyCfExample(button.getAttribute("data-example"));
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateCashFlow()) return;
      var result = window.CashFlow.buildCashFlow({
        name: cfValue("cf-name"),
        period: cfValue("cf-period"),
        beginningCash: cfValue("cf-beginning"),
        transactions: cfCollectRows(),
      });
      if (result) {
        renderCashFlow(result);
      } else {
        if (document.getElementById("cf-transactions").querySelectorAll(".cf-row").length === 0) {
          cfAddRow();
        }
        var firstSel = document.querySelector("#cf-transactions .cf-row-select");
        if (firstSel) showError(firstSel, "Add at least one cash transaction to build a statement.");
      }
    });

    form.addEventListener("reset", function () {
      window.setTimeout(resetCashFlow, 0);
    });
  }

  /* ==========================================================
     Tool Windows (full-screen overlays)
     Show/hide each tool's existing DOM inside a .tool-modal.
     No tool logic changes here; tools are wired at page load.
     ========================================================== */
  function initToolWindows() {
    var modals = document.querySelectorAll(".tool-modal");
    if (!modals.length) return;

    var activeModal = null;
    var lastTrigger = null;
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),' +
      ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function visibleFocusables(modal) {
      return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE))
        .filter(function (el) { return el.offsetParent !== null; });
    }

    function openTool(key, trigger) {
      var modal = document.getElementById("tool-modal-" + key);
      if (!modal) return;
      lastTrigger = trigger || null;
      modal.hidden = false;
      activeModal = modal;
      document.body.classList.add("modal-open");
      var closeBtn = modal.querySelector(".tool-modal-close");
      if (closeBtn) closeBtn.focus();
    }

    function closeTool() {
      if (!activeModal) return;
      activeModal.hidden = true;
      activeModal = null;
      document.body.classList.remove("modal-open");
      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
      lastTrigger = null;
    }

    document.querySelectorAll("[data-open-tool]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openTool(btn.getAttribute("data-open-tool"), btn);
      });
    });

    modals.forEach(function (modal) {
      // Backdrop click (the .tool-modal itself, not the panel) closes.
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeTool();
      });
      var closeBtn = modal.querySelector(".tool-modal-close");
      if (closeBtn) closeBtn.addEventListener("click", closeTool);
    });

    document.addEventListener("keydown", function (event) {
      if (!activeModal) return;
      if (event.key === "Escape") { event.preventDefault(); closeTool(); return; }
      if (event.key === "Tab") {
        var items = visibleFocusables(activeModal);
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });
  }

  /* ==========================================================
     Light / Dark theme
     The head script picks the starting theme before first paint
     (?theme= preview, then the saved choice, then the system
     setting, then dark). This wires the header button: it swaps
     data-theme on <html> and saves the explicit choice.
     ========================================================== */
  var THEME_KEY = "ledgerlab-theme";

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function hasSavedTheme() {
    try {
      var saved = window.localStorage.getItem(THEME_KEY);
      return saved === "light" || saved === "dark";
    } catch (e) {
      return false;
    }
  }

  function hasThemeQuery() {
    try {
      var q = new URLSearchParams(window.location.search).get("theme");
      return q === "light" || q === "dark";
    } catch (e) {
      return false;
    }
  }

  function applyTheme(theme, button) {
    var root = document.documentElement;
    // Switch instantly: suspend transitions for one frame so colours
    // don't fade unevenly across the page.
    root.classList.add("ll-theme-switching");
    root.setAttribute("data-theme", theme);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        root.classList.remove("ll-theme-switching");
      });
    });
    if (button) {
      button.setAttribute("aria-label",
        theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    }
  }

  function initThemeToggle() {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    applyTheme(currentTheme(), button);

    button.addEventListener("click", function () {
      var next = currentTheme() === "light" ? "dark" : "light";
      applyTheme(next, button);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
    });

    // Until the visitor chooses, follow changes to the system setting.
    if (window.matchMedia) {
      var media = window.matchMedia("(prefers-color-scheme: light)");
      var follow = function (event) {
        if (hasSavedTheme() || hasThemeQuery()) return;
        applyTheme(event.matches ? "light" : "dark", button);
      };
      if (media.addEventListener) media.addEventListener("change", follow);
      else if (media.addListener) media.addListener(follow);
    }
  }

  /* ==========================================================
     Tool workbench: draggable builder | document divider
     One divider per .ll-wb-grid. It only changes --wb-split (the
     builder's share in percent) on the grid, so tool data is never
     touched. The split lasts for the page session. CSS hides the
     divider whenever the panes stack. A tool can add pixel floors
     (--wb-min-build / --wb-min-doc) on top of the percentage limits.
     ========================================================== */
  var WB_SPLIT_MIN = 36;
  var WB_SPLIT_MAX = 64;

  function initToolSplitters() {
    document.querySelectorAll(".ll-wb-grid").forEach(function (grid) {
      var builder = grid.querySelector(".ll-wb-build");
      var doc = grid.querySelector(".ll-wb-doc");
      if (!builder || !doc) return;

      var fallback = parseFloat(getComputedStyle(grid).getPropertyValue("--wb-split-default"));
      if (isNaN(fallback)) fallback = 50;
      if (!doc.id) doc.id = (builder.id || "wb") + "-doc";

      var handle = document.createElement("div");
      handle.className = "ll-wb-split";
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      handle.setAttribute("aria-label", "Resize tool panels");
      handle.setAttribute("aria-controls", builder.id + " " + doc.id);
      handle.tabIndex = 0;
      handle.innerHTML = '<span class="ll-wb-split-grip" aria-hidden="true"></span>';
      grid.insertBefore(handle, doc);

      // Effective limits for the grid's current width.
      function limits() {
        var style = getComputedStyle(grid);
        var width = grid.getBoundingClientRect().width || 1;
        var minBuild = parseFloat(style.getPropertyValue("--wb-min-build")) || 0;
        var minDoc = parseFloat(style.getPropertyValue("--wb-min-doc")) || 0;
        var lo = Math.max(WB_SPLIT_MIN, (minBuild / width) * 100);
        var hi = Math.min(WB_SPLIT_MAX, 100 - (minDoc / width) * 100);
        if (lo > hi) lo = hi = fallback;
        return { lo: lo, hi: hi };
      }

      var current = fallback;
      function apply(value, isDefault) {
        var range = limits();
        current = isDefault ? fallback : Math.min(range.hi, Math.max(range.lo, value));
        handle.setAttribute("aria-valuemin", String(Math.round(range.lo)));
        handle.setAttribute("aria-valuemax", String(Math.round(range.hi)));
        if (isDefault) grid.style.removeProperty("--wb-split");
        else grid.style.setProperty("--wb-split", current.toFixed(2));
        var shown = Math.round(current);
        handle.setAttribute("aria-valuenow", String(shown));
        handle.setAttribute("aria-valuetext",
          "Inputs " + shown + "%, document " + (100 - shown) + "%");
      }
      apply(fallback, true);

      function fromPointer(clientX) {
        var rect = grid.getBoundingClientRect();
        if (rect.width) apply(((clientX - rect.left) / rect.width) * 100);
      }

      handle.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        handle.classList.add("is-dragging");
        document.body.classList.add("ll-wb-resizing");
        handle.focus({ preventScroll: true });
      });
      handle.addEventListener("pointermove", function (event) {
        if (handle.hasPointerCapture(event.pointerId)) fromPointer(event.clientX);
      });
      function endDrag(event) {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        handle.classList.remove("is-dragging");
        document.body.classList.remove("ll-wb-resizing");
      }
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);

      // Limits depend on the grid's width, so refresh them when focused.
      handle.addEventListener("focus", function () {
        apply(current, grid.style.getPropertyValue("--wb-split") === "");
      });

      // Double-click returns to the tool's default split.
      handle.addEventListener("dblclick", function () { apply(fallback, true); });

      handle.addEventListener("keydown", function (event) {
        var step = event.shiftKey ? 8 : 2;
        if (event.key === "ArrowLeft") apply(current - step);
        else if (event.key === "ArrowRight") apply(current + step);
        else if (event.key === "Home") apply(0);
        else if (event.key === "End") apply(100);
        else return;
        event.preventDefault();
      });
    });
  }

  /* ==========================================================
     Example chips: plain-English explanation on hover / focus
     Each chip points at its hidden .ll-ex-tip text through
     aria-describedby (so screen readers announce it). One shared
     bubble shows that text visually, kept inside the tool window.
     ========================================================== */
  function initExampleTips() {
    var chips = document.querySelectorAll(".ll-chip[aria-describedby]");
    if (!chips.length) return;

    var bubble = document.createElement("div");
    bubble.className = "ll-ex-bubble";
    bubble.setAttribute("aria-hidden", "true");
    bubble.hidden = true;
    document.body.appendChild(bubble);

    var owner = null;
    var hovered = null;

    function place(chip) {
      var panel = chip.closest(".tool-modal-panel");
      var bounds = panel ? panel.getBoundingClientRect()
        : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      var r = chip.getBoundingClientRect();
      var gap = 8, edge = 12;
      bubble.style.maxWidth = Math.min(304, bounds.right - bounds.left - edge * 2) + "px";
      var w = bubble.offsetWidth, h = bubble.offsetHeight;
      var left = r.left + r.width / 2 - w / 2;
      left = Math.max(bounds.left + edge, Math.min(left, bounds.right - edge - w));
      var below = r.bottom + gap;
      var above = r.top - gap - h;
      var top = below + h <= bounds.bottom - edge || above < bounds.top + edge ? below : above;
      bubble.classList.toggle("is-above", top === above);
      bubble.style.left = Math.round(left) + "px";
      bubble.style.top = Math.round(top) + "px";
      bubble.style.setProperty("--ll-ex-arrow",
        Math.round(Math.min(Math.max(r.left + r.width / 2 - left, 14), w - 14)) + "px");
    }

    function show(chip) {
      var source = document.getElementById(chip.getAttribute("aria-describedby"));
      if (!source) return;
      owner = chip;
      bubble.textContent = source.textContent;
      bubble.hidden = false;
      place(chip);
    }

    function hide() {
      owner = null;
      bubble.hidden = true;
    }

    function settle() {
      var focused = document.activeElement;
      var next = hovered || (focused && focused.matches &&
        focused.matches(".ll-chip[aria-describedby]") ? focused : null);
      if (next && next.offsetParent !== null) { if (next !== owner) show(next); }
      else hide();
    }

    chips.forEach(function (chip) {
      chip.addEventListener("mouseenter", function () { hovered = chip; settle(); });
      chip.addEventListener("mouseleave", function () { if (hovered === chip) hovered = null; settle(); });
      chip.addEventListener("focus", settle);
      chip.addEventListener("blur", function () { window.setTimeout(settle, 0); });
    });

    // Escape and scrolling hide the bubble; Escape still closes the window as before.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && owner) { hovered = null; hide(); }
    }, true);
    document.querySelectorAll(".tool-modal-body").forEach(function (body) {
      body.addEventListener("scroll", function () { if (owner) place(owner); }, { passive: true });
    });
    window.addEventListener("resize", function () { if (owner) place(owner); });
    document.querySelectorAll(".tool-modal-close").forEach(function (btn) {
      btn.addEventListener("click", function () { hovered = null; hide(); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initSmoothScroll();
    initActiveNav();
    initMissionToggle();
    initMoneyInputs();
    initSimulator();
    initPlanning();
    initModeTabs();
    initJournalEntry();
    initJournalExamples();
    initBankReconciliation();
    initDepreciation();
    initIncomeStatement();
    initCashFlow();
    initToolWindows();
    initToolSplitters();
    initExampleTips();
    resetSimulatorState();
    resetJournalEntry();
    resetBankReconciliation();
    resetDepreciation();
    resetIncomeStatement();
    resetCashFlow();
  });

  // Also clear when the page is shown from the back/forward cache, where the
  // browser would otherwise restore the previously entered values.
  window.addEventListener("pageshow", function () {
    resetSimulatorState();
    resetJournalEntry();
    resetBankReconciliation();
    resetDepreciation();
    resetIncomeStatement();
    resetCashFlow();
  });
})();
