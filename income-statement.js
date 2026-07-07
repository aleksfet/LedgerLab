/* ============================================================
   LedgerLab — income-statement.js
   Pure logic for the Income Statement Builder (v1, single-step).
   No DOM here: unit-testable in Node and also attaches to
   window.IncomeStatement for the browser.

   Single-step: Total Revenue - Total Expenses = Net Income/Loss.
   ============================================================ */

(function (root) {
  "use strict";

  /** Round to 2 decimals (cents). */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /** Coerce to a finite, non-negative number (blank/NaN/negative -> 0). */
  function money(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  // Fixed expense categories, in statement order. `key` selects advice copy.
  var EXPENSE_KEYS = [
    { key: "rent", label: "Rent expense" },
    { key: "wages", label: "Wages expense" },
    { key: "supplies", label: "Supplies expense" },
    { key: "utilities", label: "Utilities expense" },
    { key: "depreciation", label: "Depreciation expense" },
    { key: "other", label: "Other expenses" },
  ];

  // Category-adaptive managerial review guidance (see spec section 6).
  var ADVICE = {
    rent: "A manager would review the location's cost, the lease terms, and whether the space is being fully used.",
    wages: "A manager would review staffing levels, scheduling, productivity, and whether current revenue is high enough to support payroll.",
    supplies: "A manager would review purchasing, waste, vendor pricing, and how supplies are being used.",
    utilities: "A manager would review energy efficiency and investigate any unusual increases.",
    depreciation: "This is a non-cash expense tied to using long-term assets over time, not money leaving the business this period.",
    other: 'A manager would review the underlying items, since "Other" can hide significant costs that belong in their own category.',
    custom: "A manager would review the underlying items behind this line to understand what's driving the cost.",
  };

  function bandFor(margin) {
    if (margin < 0) return "loss";
    if (margin < 0.1) return "thin";
    if (margin < 0.2) return "healthy";
    return "strong";
  }

  /**
   * Build a single-step income statement view-model.
   * @param {object} inputs - { name, period, revenue, rent, wages, supplies,
   *   utilities, depreciation, other, customRevenue:[{label,amount}],
   *   customExpenses:[{label,amount}] }
   * @returns {object|null} null when there is nothing to compute.
   */
  function buildIncomeStatement(inputs) {
    inputs = inputs || {};

    var name = (inputs.name || "").toString();
    var period = (inputs.period || "").toString();

    // Revenue lines: sales/service (if > 0) + custom revenue rows (amount > 0).
    var revenueLines = [];
    var sales = money(inputs.revenue);
    if (sales > 0) revenueLines.push({ label: "Sales / service revenue", amount: sales });
    (inputs.customRevenue || []).forEach(function (row) {
      var amt = money(row && row.amount);
      var label = ((row && row.label) || "").toString().trim();
      if (amt > 0 && label !== "") revenueLines.push({ label: label, amount: amt });
    });

    // Expense lines: six fixed (always) + custom expense rows (amount > 0).
    var expenseLines = EXPENSE_KEYS.map(function (cat) {
      return { label: cat.label, amount: money(inputs[cat.key]), key: cat.key };
    });
    (inputs.customExpenses || []).forEach(function (row) {
      var amt = money(row && row.amount);
      var label = ((row && row.label) || "").toString().trim();
      if (amt > 0 && label !== "") expenseLines.push({ label: label, amount: amt, key: "custom" });
    });

    var totalRevenue = round2(
      revenueLines.reduce(function (s, l) { return s + l.amount; }, 0)
    );
    var totalExpenses = round2(
      expenseLines.reduce(function (s, l) { return s + l.amount; }, 0)
    );

    if (totalRevenue === 0 && totalExpenses === 0) return null;

    var netIncome = round2(totalRevenue - totalExpenses);
    var margin = totalRevenue > 0 ? netIncome / totalRevenue : null;
    var marginBand = margin === null ? null : bandFor(margin);
    var centsKept = margin === null ? null : Math.round(margin * 100);

    // Largest expense across every line with amount > 0 (fixed order, then custom).
    var largestExpense = null;
    expenseLines.forEach(function (l) {
      if (l.amount > 0 && (largestExpense === null || l.amount > largestExpense.amount)) {
        largestExpense = {
          label: l.label,
          amount: l.amount,
          key: l.key,
          pctOfRevenue: totalRevenue > 0 ? round2(l.amount / totalRevenue) : null,
        };
      }
    });

    return {
      name: name,
      period: period,
      revenueLines: revenueLines,
      expenseLines: expenseLines,
      totalRevenue: totalRevenue,
      totalExpenses: totalExpenses,
      netIncome: netIncome,
      isLoss: netIncome < 0,
      margin: margin,
      marginBand: marginBand,
      centsKept: centsKept,
      largestExpense: largestExpense,
      hasDepreciation: money(inputs.depreciation) > 0,
    };
  }

  var api = {
    round2: round2,
    EXPENSE_KEYS: EXPENSE_KEYS,
    ADVICE: ADVICE,
    buildIncomeStatement: buildIncomeStatement,
  };

  // Dual export: Node (tests) + browser (window.IncomeStatement). No libraries.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.IncomeStatement = api;
  }
})(typeof self !== "undefined" ? self : this);
