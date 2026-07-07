/* ============================================================
   Tests for cash-flow.js
   Run with: node tests/cash-flow.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */
"use strict";
var assert = require("assert");
var CF = require("../cash-flow.js");
var build = CF.buildCashFlow;

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok - " + name); }

console.log("cash-flow.js");

test("classifies each preset into the right section with the right sign", function () {
  var r = build({ transactions: [
    { type: "cust", amount: 100 }, { type: "rent", amount: 40 },
    { type: "buy-equip", amount: 30 }, { type: "sell-equip", amount: 10 },
    { type: "owner-invest", amount: 50 }, { type: "loan-principal", amount: 20 },
  ]});
  assert.strictEqual(r.operating.subtotal, 60);   // +100 - 40
  assert.strictEqual(r.investing.subtotal, -20);  // -30 + 10
  assert.strictEqual(r.financing.subtotal, 30);   // +50 - 20
  assert.strictEqual(r.operating.lines[0].amount, 100);
  assert.strictEqual(r.operating.lines[1].amount, -40);
});

test("net change = sum of subtotals; ending = beginning + net change", function () {
  var r = build({ beginningCash: 1000, transactions: [
    { type: "cust", amount: 500 }, { type: "wages", amount: 200 },
    { type: "buy-equip", amount: 300 }, { type: "loan-proceeds", amount: 100 },
  ]});
  assert.strictEqual(r.operating.subtotal, 300);
  assert.strictEqual(r.investing.subtotal, -300);
  assert.strictEqual(r.financing.subtotal, 100);
  assert.strictEqual(r.netChange, 100);
  assert.strictEqual(r.endingCash, 1100);
  assert.strictEqual(r.isNetPositive, true);
});

test("negative net change flips isNetPositive false", function () {
  var r = build({ beginningCash: 500, transactions: [
    { type: "rent", amount: 400 }, { type: "wages", amount: 300 },
  ]});
  assert.strictEqual(r.netChange, -700);
  assert.strictEqual(r.endingCash, -200);
  assert.strictEqual(r.isNetPositive, false);
});

test("blank/missing beginning cash counts as 0", function () {
  var r = build({ transactions: [{ type: "cust", amount: 250 }] });
  assert.strictEqual(r.beginningCash, 0);
  assert.strictEqual(r.endingCash, 250);
});

test("negative and NaN amounts are coerced to 0 (row skipped)", function () {
  var r = build({ transactions: [
    { type: "cust", amount: -5 }, { type: "rent", amount: "abc" },
    { type: "wages", amount: 100 },
  ]});
  assert.strictEqual(r.operating.subtotal, -100);
  assert.strictEqual(r.operating.lines.length, 1);
});

test("unknown transaction types and amount<=0 rows are skipped", function () {
  var r = build({ transactions: [
    { type: "mystery", amount: 100 }, { type: "cust", amount: 0 },
    { type: "cust", amount: 80 },
  ]});
  assert.strictEqual(r.operating.lines.length, 1);
  assert.strictEqual(r.operating.subtotal, 80);
});

test("returns null when there are no valid transactions", function () {
  assert.strictEqual(build({ transactions: [] }), null);
  assert.strictEqual(build({ beginningCash: 999, transactions: [{ type: "x", amount: 5 }] }), null);
});

test("flags: hasEquipmentPurchase and hasOwnerInvestment", function () {
  var r = build({ transactions: [
    { type: "buy-equip", amount: 100 }, { type: "owner-invest", amount: 200 },
  ]});
  assert.strictEqual(r.flags.hasEquipmentPurchase, true);
  assert.strictEqual(r.flags.hasOwnerInvestment, true);
});

test("reliedOnFinancing true only when operating<0 AND financing>0", function () {
  var relied = build({ transactions: [
    { type: "rent", amount: 500 }, { type: "owner-invest", amount: 800 },
  ]});
  assert.strictEqual(relied.flags.reliedOnFinancing, true);
  var positiveOp = build({ transactions: [
    { type: "cust", amount: 500 }, { type: "owner-invest", amount: 800 },
  ]});
  assert.strictEqual(positiveOp.flags.reliedOnFinancing, false);
  var noFinancing = build({ transactions: [{ type: "rent", amount: 500 }] });
  assert.strictEqual(noFinancing.flags.reliedOnFinancing, false);
});

test("subtotals, net change, and ending cash round to cents", function () {
  var r = build({ beginningCash: 0.005, transactions: [
    { type: "cust", amount: 10.005 }, { type: "rent", amount: 0.004 },
  ]});
  assert.strictEqual(r.operating.subtotal, 10.0);
  assert.strictEqual(r.netChange, 10.0);
});

console.log("\nAll " + passed + " tests passed.");
