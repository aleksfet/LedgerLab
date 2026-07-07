/* ============================================================
   LedgerLab — cash-flow.js
   Pure logic for the Cash Flow Helper (v1, simplified direct method).
   No DOM here: unit-testable in Node and also attaches to
   window.CashFlow for the browser.

   Groups preset cash transactions into Operating / Investing /
   Financing, subtotals each, then Net change + Beginning->Ending cash.
   ============================================================ */
(function (root) {
  "use strict";

  /** Round to 2 decimals (cents). */
  function round2(value) { return Math.round(value * 100) / 100; }

  /** Coerce to a finite, non-negative number (blank/NaN/negative -> 0). */
  function money(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  // Fixed catalog: each preset carries its category and cash direction.
  // direction "in" = cash inflow (+), "out" = cash outflow (-).
  var CATALOG = [
    { id: "cust", label: "Cash received from customers", category: "operating", direction: "in" },
    { id: "rent", label: "Paid rent", category: "operating", direction: "out" },
    { id: "wages", label: "Paid wages", category: "operating", direction: "out" },
    { id: "buy-equip", label: "Bought equipment", category: "investing", direction: "out" },
    { id: "sell-equip", label: "Sold equipment", category: "investing", direction: "in" },
    { id: "owner-invest", label: "Owner invested cash", category: "financing", direction: "in" },
    { id: "loan-proceeds", label: "Loan proceeds", category: "financing", direction: "in" },
    { id: "loan-principal", label: "Paid loan principal", category: "financing", direction: "out" },
    { id: "owner-withdraw", label: "Owner withdrew cash", category: "financing", direction: "out" },
  ];

  var CATALOG_BY_ID = {};
  CATALOG.forEach(function (c) { CATALOG_BY_ID[c.id] = c; });

  /**
   * Build a simplified statement-of-cash-flows view-model.
   * @param {object} inputs - { name, period, beginningCash,
   *   transactions:[{ type, amount }] }
   * @returns {object|null} null when there is nothing to compute.
   */
  function buildCashFlow(inputs) {
    inputs = inputs || {};
    var name = (inputs.name || "").toString();
    var period = (inputs.period || "").toString();
    var beginningCash = round2(money(inputs.beginningCash));

    var buckets = {
      operating: { lines: [], subtotal: 0 },
      investing: { lines: [], subtotal: 0 },
      financing: { lines: [], subtotal: 0 },
    };
    var flags = {
      hasEquipmentPurchase: false,
      hasOwnerInvestment: false,
      reliedOnFinancing: false,
    };

    var count = 0;
    (inputs.transactions || []).forEach(function (row) {
      var cat = CATALOG_BY_ID[row && row.type];
      var amt = money(row && row.amount);
      if (!cat || amt <= 0) return;
      var signed = cat.direction === "in" ? amt : -amt;
      buckets[cat.category].lines.push({ label: cat.label, amount: signed });
      count++;
      if (cat.id === "buy-equip") flags.hasEquipmentPurchase = true;
      if (cat.id === "owner-invest") flags.hasOwnerInvestment = true;
    });

    if (count === 0) return null;

    ["operating", "investing", "financing"].forEach(function (k) {
      buckets[k].subtotal = round2(
        buckets[k].lines.reduce(function (s, l) { return s + l.amount; }, 0)
      );
    });

    var netChange = round2(
      buckets.operating.subtotal + buckets.investing.subtotal + buckets.financing.subtotal
    );
    var endingCash = round2(beginningCash + netChange);

    flags.reliedOnFinancing =
      buckets.operating.subtotal < 0 && buckets.financing.subtotal > 0;

    return {
      name: name,
      period: period,
      beginningCash: beginningCash,
      endingCash: endingCash,
      operating: buckets.operating,
      investing: buckets.investing,
      financing: buckets.financing,
      netChange: netChange,
      isNetPositive: netChange >= 0,
      flags: flags,
    };
  }

  var api = { round2: round2, CATALOG: CATALOG, buildCashFlow: buildCashFlow };

  // Dual export: Node (tests) + browser (window.CashFlow). No libraries.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CashFlow = api;
  }
})(typeof self !== "undefined" ? self : this);
