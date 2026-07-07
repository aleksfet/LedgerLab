/* ============================================================
   Tests for income-statement.js
   Run with: node tests/income-statement.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */

"use strict";

var assert = require("assert");
var IS = require("../income-statement.js");
var build = IS.buildIncomeStatement;

var passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}

console.log("income-statement.js");

test("totals include fixed fields and custom rows", function () {
  var r = build({
    revenue: 15000,
    rent: 3000, wages: 6000, supplies: 800, utilities: 700,
    depreciation: 500, other: 400,
    customRevenue: [{ label: "Interest income", amount: 100 }],
    customExpenses: [{ label: "Marketing", amount: 200 }],
  });
  assert.strictEqual(r.totalRevenue, 15100);
  assert.strictEqual(r.totalExpenses, 11600);
  assert.strictEqual(r.netIncome, 3500);
  assert.strictEqual(r.isLoss, false);
});

test("six fixed expense lines always present, in order, even when zero", function () {
  var r = build({ revenue: 1000 });
  var keys = r.expenseLines.map(function (l) { return l.key; });
  assert.deepStrictEqual(keys, ["rent", "wages", "supplies", "utilities", "depreciation", "other"]);
  assert.strictEqual(r.expenseLines[0].amount, 0);
});

test("custom expense rows with amount>0 append after fixed lines; blanks ignored", function () {
  var r = build({
    revenue: 1000,
    customExpenses: [
      { label: "Marketing", amount: 200 },
      { label: "", amount: 0 },
    ],
  });
  assert.strictEqual(r.expenseLines.length, 7);
  assert.strictEqual(r.expenseLines[6].key, "custom");
  assert.strictEqual(r.expenseLines[6].label, "Marketing");
});

test("net loss when expenses exceed revenue", function () {
  var r = build({ revenue: 1000, rent: 1500 });
  assert.strictEqual(r.netIncome, -500);
  assert.strictEqual(r.isLoss, true);
  assert.strictEqual(r.marginBand, "loss");
});

test("margin bands at boundaries", function () {
  assert.strictEqual(build({ revenue: 100, rent: 101 }).marginBand, "loss");    // -1%
  assert.strictEqual(build({ revenue: 100, rent: 95 }).marginBand, "thin");     // 5%
  assert.strictEqual(build({ revenue: 100, rent: 90 }).marginBand, "healthy");  // exactly 10% -> healthy
  assert.strictEqual(build({ revenue: 100, rent: 85 }).marginBand, "healthy");  // 15%
  assert.strictEqual(build({ revenue: 100, rent: 80 }).marginBand, "strong");   // exactly 20% -> strong
  assert.strictEqual(build({ revenue: 100, rent: 50 }).marginBand, "strong");   // 50%
});

test("centsKept rounds margin to whole cents", function () {
  var r = build({ revenue: 15000, rent: 11400 });  // margin 0.24
  assert.strictEqual(r.centsKept, 24);
});

test("zero revenue: margin/band/centsKept null, still computes loss", function () {
  var r = build({ rent: 500 });
  assert.strictEqual(r.totalRevenue, 0);
  assert.strictEqual(r.margin, null);
  assert.strictEqual(r.marginBand, null);
  assert.strictEqual(r.centsKept, null);
  assert.strictEqual(r.netIncome, -500);
  assert.strictEqual(r.isLoss, true);
});

test("largest expense picks the biggest line and its % of revenue", function () {
  var r = build({ revenue: 10000, rent: 2000, wages: 3800 });
  assert.strictEqual(r.largestExpense.key, "wages");
  assert.strictEqual(r.largestExpense.amount, 3800);
  assert.strictEqual(r.largestExpense.pctOfRevenue, 0.38);
});

test("largest expense can be a custom row", function () {
  var r = build({ revenue: 10000, rent: 100, customExpenses: [{ label: "Loan interest", amount: 5000 }] });
  assert.strictEqual(r.largestExpense.key, "custom");
  assert.strictEqual(r.largestExpense.label, "Loan interest");
});

test("largest expense tie resolves to first in fixed order", function () {
  var r = build({ revenue: 10000, rent: 500, wages: 500 });
  assert.strictEqual(r.largestExpense.key, "rent");
});

test("largest expense null when no expense > 0", function () {
  var r = build({ revenue: 1000 });
  assert.strictEqual(r.largestExpense, null);
});

test("hasDepreciation only when depreciation > 0", function () {
  assert.strictEqual(build({ revenue: 1000, depreciation: 1 }).hasDepreciation, true);
  assert.strictEqual(build({ revenue: 1000 }).hasDepreciation, false);
});

test("revenue lines: sales line shown only when > 0; custom appended", function () {
  var r = build({ revenue: 500, customRevenue: [{ label: "Interest", amount: 50 }] });
  assert.strictEqual(r.revenueLines.length, 2);
  assert.strictEqual(r.revenueLines[0].amount, 500);
  assert.strictEqual(r.revenueLines[1].label, "Interest");
  var r2 = build({ rent: 100 });  // no revenue
  assert.strictEqual(r2.revenueLines.length, 0);
});

test("returns null when nothing to compute", function () {
  assert.strictEqual(build({}), null);
  assert.strictEqual(build({ revenue: 0, rent: 0 }), null);
});

test("negative/NaN amounts are coerced to 0", function () {
  var r = build({ revenue: 1000, rent: -50, wages: NaN });
  assert.strictEqual(r.expenseLines[0].amount, 0);
  assert.strictEqual(r.expenseLines[1].amount, 0);
  assert.strictEqual(r.totalExpenses, 0);
});

console.log("\nAll " + passed + " tests passed.");
