/* ============================================================
   LedgerLab — depreciation.js
   Pure logic for the Depreciation Calculator (v1, straight-line).
   No DOM here: unit-testable in Node and also attaches to
   window.Depreciation for the browser.

   Straight-line with a final-year true-up so the ending book
   value lands exactly on salvage:
     depreciableBase = cost - salvage
     standardAnnual  = round2(base / usefulLife)
     years 1..n-1    use standardAnnual
     final year      = base - standardAnnual * (n - 1)
   ============================================================ */

(function (root) {
  "use strict";

  /** Round to 2 decimals (cents). */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /**
   * Compute a straight-line depreciation schedule.
   * @param {object} inputs - { name, cost, salvage, usefulLife }
   * @returns {object|null} null if inputs are non-numeric / out of range.
   *
   * Result:
   *   {
   *     name, cost, salvage, usefulLife, method,
   *     depreciableBase, annual, monthly,
   *     schedule: [ { year, expense, accumulated, bookValue } ],
   *     journal: { debit, credit, amount }
   *   }
   */
  function calculateDepreciation(inputs) {
    inputs = inputs || {};

    var name = (inputs.name || "").toString();
    var cost = Number(inputs.cost);
    var salvage = Number(inputs.salvage);
    var usefulLife = Number(inputs.usefulLife);

    // Guard rails (the UI validates too, but keep the pure logic safe).
    if (!isFinite(cost) || !isFinite(salvage) || !isFinite(usefulLife)) return null;
    if (cost <= 0 || salvage < 0 || salvage >= cost) return null;
    if (usefulLife < 1 || Math.floor(usefulLife) !== usefulLife) return null;

    var depreciableBase = round2(cost - salvage);
    var standardAnnual = round2(depreciableBase / usefulLife);
    var monthly = round2(standardAnnual / 12);

    var schedule = [];
    var accumulated = 0;
    for (var year = 1; year <= usefulLife; year++) {
      var expense;
      if (year < usefulLife) {
        expense = standardAnnual;
      } else {
        // Final year: whatever is left so book value ends exactly at salvage.
        expense = round2(depreciableBase - standardAnnual * (usefulLife - 1));
      }
      accumulated = round2(accumulated + expense);
      var bookValue = round2(cost - accumulated);
      schedule.push({
        year: year,
        expense: expense,
        accumulated: accumulated,
        bookValue: bookValue,
      });
    }

    return {
      name: name,
      cost: cost,
      salvage: salvage,
      usefulLife: usefulLife,
      method: "Straight-Line",
      depreciableBase: depreciableBase,
      annual: standardAnnual,
      monthly: monthly,
      schedule: schedule,
      journal: {
        debit: "Depreciation Expense",
        credit: "Accumulated Depreciation",
        amount: standardAnnual,
      },
    };
  }

  var api = {
    round2: round2,
    calculateDepreciation: calculateDepreciation,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Depreciation = api;
  }
})(typeof self !== "undefined" ? self : this);
