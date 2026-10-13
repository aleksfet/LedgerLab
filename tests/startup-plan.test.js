/* ============================================================
   Tests for the Startup Planning core in script.js
   Run with: node tests/startup-plan.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */
"use strict";
var assert = require("assert");
var Core = require("../script.js");
var plan = Core.computeStartupPlan;
var usage = Core.startupCashUsage;

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok - " + name); }

console.log("script.js — Startup Planning core");

var BASE = {
  startingCash: 20000, targetProfit: 3000, hasTarget: true, revenue: 11000,
  rent: 2200, wages: 4000, supplies: 900, utilities: 350, marketing: 600, other: 300,
  equipment: 9000, inventory: 4000,
};

test("reproduces the pre-change plan when there are no other startup costs", function () {
  var r = plan(BASE);
  assert.strictEqual(r.totalExpenses, 8350);
  assert.strictEqual(r.expectedProfit, 2650);
  assert.strictEqual(r.targetGap, 350);
  assert.strictEqual(r.startupPurchases, 13000);
  assert.strictEqual(r.cashLeft, 9650);
});

test("startup purchases = equipment + inventory + other startup costs", function () {
  var r = plan(Object.assign({}, BASE, { otherStartup: 1500 }));
  assert.strictEqual(r.startupPurchases, 14500);
});

test("cash left still reconciles with other startup costs included", function () {
  var r = plan(Object.assign({}, BASE, { otherStartup: 1500 }));
  // cash to start - startup purchases + expected profit
  assert.strictEqual(r.cashLeft, 20000 - 14500 + 2650);
  assert.strictEqual(r.cashLeft, 8150);
});

test("other startup costs do not touch monthly expenses, profit or target gap", function () {
  var a = plan(BASE);
  var b = plan(Object.assign({}, BASE, { otherStartup: 1500 }));
  assert.strictEqual(b.totalExpenses, a.totalExpenses);
  assert.strictEqual(b.expectedProfit, a.expectedProfit);
  assert.strictEqual(b.targetGap, a.targetGap);
});

test("missing optional amounts count as $0", function () {
  var r = plan({ startingCash: 5000, revenue: 3000 });
  assert.strictEqual(r.totalExpenses, 0);
  assert.strictEqual(r.expectedProfit, 3000);
  assert.strictEqual(r.startupPurchases, 0);
  assert.strictEqual(r.cashLeft, 8000);
});

test("hasTarget distinguishes no target from a real $0 target", function () {
  var none = plan({ startingCash: 1000, revenue: 500 });
  var zero = plan({ startingCash: 1000, revenue: 500, targetProfit: 0, hasTarget: true });
  assert.strictEqual(none.hasTarget, false);
  assert.strictEqual(zero.hasTarget, true);
  // The arithmetic stays backward compatible: both read a $0 target.
  assert.strictEqual(none.targetGap, zero.targetGap);
});

test("startup cash usage includes other startup costs", function () {
  var r = plan(Object.assign({}, BASE, { equipment: 0, inventory: 0, otherStartup: 7000 }));
  var u = usage(r.startupPurchases, BASE.startingCash);
  assert.strictEqual(u.pct, 35);
  assert.strictEqual(u.band, "watch");
});

test("startup cash usage bands keep their existing boundaries", function () {
  assert.strictEqual(usage(3000, 10000).band, "healthy");
  assert.strictEqual(usage(6000, 10000).band, "watch");
  assert.strictEqual(usage(8000, 10000).band, "risky");
  assert.strictEqual(usage(8001, 10000).band, "veryRisky");
  assert.strictEqual(usage(8000, 10000).tight, true);
  assert.strictEqual(usage(6000, 10000).tight, false);
});

test("startup cash usage: none without purchases, over budget without cash", function () {
  assert.strictEqual(usage(0, 10000), null);
  var u = usage(500, 0);
  assert.strictEqual(u.pct, Infinity);
  assert.strictEqual(u.band, "veryRisky");
});

console.log("All " + passed + " tests passed.");
