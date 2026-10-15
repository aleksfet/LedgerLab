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

// Results pinned from the committed Startup Planning core (before the results
// redesign). Scenario: [inputs as the form passes them, expected result,
// expected startup-cash band]. Blank optional fields are simply absent.
var PINNED = {
  "riverside": [{"startingCash":20000,"targetProfit":3000,"hasTarget":true,"revenue":11000,"rent":2200,"wages":4000,"supplies":900,"utilities":350,"marketing":600,"other":300,"equipment":9000,"inventory":4000}, {"totalExpenses":8350,"expectedProfit":2650,"targetGap":350,"startupPurchases":13000,"cashLeft":9650,"hasTarget":true}, "risky"],
  "profitable": [{"startingCash":30000,"hasTarget":false,"revenue":15000,"rent":2500,"wages":5000,"supplies":1200,"utilities":400,"marketing":500,"other":300,"equipment":6000,"inventory":2000,"otherStartup":1000}, {"totalExpenses":9900,"expectedProfit":5100,"targetGap":-5100,"startupPurchases":9000,"cashLeft":26100,"hasTarget":false}, "healthy"],
  "loss": [{"startingCash":15000,"targetProfit":2000,"hasTarget":true,"revenue":6000,"rent":2500,"wages":4000,"supplies":600,"utilities":300,"marketing":400,"other":200,"equipment":5000,"inventory":1000,"otherStartup":500}, {"totalExpenses":8000,"expectedProfit":-2000,"targetGap":4000,"startupPurchases":6500,"cashLeft":6500,"hasTarget":true}, "watch"],
  "breakevenZeroTarget": [{"startingCash":10000,"targetProfit":0,"hasTarget":true,"revenue":8000,"rent":2000,"wages":4000,"supplies":1000,"utilities":400,"marketing":400,"other":200,"equipment":3000,"inventory":1000}, {"totalExpenses":8000,"expectedProfit":0,"targetGap":0,"startupPurchases":4000,"cashLeft":6000,"hasTarget":true}, "watch"],
  "breakeven": [{"startingCash":10000,"hasTarget":false,"revenue":8000,"rent":2000,"wages":4000,"supplies":1000,"utilities":400,"marketing":400,"other":200,"equipment":3000,"inventory":1000}, {"totalExpenses":8000,"expectedProfit":0,"targetGap":0,"startupPurchases":4000,"cashLeft":6000,"hasTarget":false}, "watch"],
  "noTarget": [{"startingCash":12000,"hasTarget":false,"revenue":9000,"rent":1800,"wages":3000,"supplies":700,"utilities":250,"marketing":300,"other":150,"equipment":2000,"inventory":1500}, {"totalExpenses":6200,"expectedProfit":2800,"targetGap":-2800,"startupPurchases":3500,"cashLeft":11300,"hasTarget":false}, "healthy"],
  "zeroTarget": [{"startingCash":12000,"targetProfit":0,"hasTarget":true,"revenue":9000,"rent":1800,"wages":3000,"supplies":700,"utilities":250,"marketing":300,"other":150,"equipment":2000,"inventory":1500}, {"totalExpenses":6200,"expectedProfit":2800,"targetGap":-2800,"startupPurchases":3500,"cashLeft":11300,"hasTarget":true}, "healthy"],
  "zeroTargetLoss": [{"startingCash":12000,"targetProfit":0,"hasTarget":true,"revenue":5000,"rent":1800,"wages":3000,"supplies":700,"utilities":250,"marketing":300,"other":150,"equipment":2000,"inventory":1500}, {"totalExpenses":6200,"expectedProfit":-1200,"targetGap":1200,"startupPurchases":3500,"cashLeft":7300,"hasTarget":true}, "healthy"],
  "targetMissed": [{"startingCash":20000,"targetProfit":5000,"hasTarget":true,"revenue":11000,"rent":2200,"wages":4000,"supplies":900,"utilities":350,"marketing":600,"other":300,"equipment":4000,"inventory":2000}, {"totalExpenses":8350,"expectedProfit":2650,"targetGap":2350,"startupPurchases":6000,"cashLeft":16650,"hasTarget":true}, "healthy"],
  "targetExceeded": [{"startingCash":20000,"targetProfit":1000,"hasTarget":true,"revenue":11000,"rent":2200,"wages":4000,"supplies":900,"utilities":350,"marketing":600,"other":300,"equipment":4000,"inventory":2000}, {"totalExpenses":8350,"expectedProfit":2650,"targetGap":-1650,"startupPurchases":6000,"cashLeft":16650,"hasTarget":true}, "healthy"],
  "noPurchases": [{"startingCash":5000,"targetProfit":2000,"hasTarget":true,"revenue":7000,"rent":0,"wages":2500,"supplies":100,"utilities":100,"marketing":200,"other":100}, {"totalExpenses":3000,"expectedProfit":4000,"targetGap":-2000,"startupPurchases":0,"cashLeft":9000,"hasTarget":true}, null],
  "equipOnly": [{"startingCash":18000,"hasTarget":false,"revenue":10000,"rent":2000,"wages":3500,"supplies":800,"utilities":300,"marketing":300,"other":200,"equipment":12000}, {"totalExpenses":7100,"expectedProfit":2900,"targetGap":-2900,"startupPurchases":12000,"cashLeft":8900,"hasTarget":false}, "risky"],
  "invOnly": [{"startingCash":15000,"targetProfit":1500,"hasTarget":true,"revenue":9000,"rent":1500,"wages":2500,"supplies":900,"utilities":250,"marketing":300,"other":100,"inventory":6000}, {"totalExpenses":5550,"expectedProfit":3450,"targetGap":-1950,"startupPurchases":6000,"cashLeft":12450,"hasTarget":true}, "watch"],
  "otherStartupOnly": [{"startingCash":10000,"hasTarget":false,"revenue":6000,"rent":1200,"wages":2000,"supplies":400,"utilities":200,"marketing":200,"other":100,"otherStartup":3500}, {"totalExpenses":4100,"expectedProfit":1900,"targetGap":-1900,"startupPurchases":3500,"cashLeft":8400,"hasTarget":false}, "watch"],
  "lowCash": [{"startingCash":800,"targetProfit":500,"hasTarget":true,"revenue":4000,"rent":1000,"wages":1500,"supplies":300,"utilities":150,"marketing":100,"other":50,"equipment":300,"inventory":200}, {"totalExpenses":3100,"expectedProfit":900,"targetGap":-400,"startupPurchases":500,"cashLeft":1200,"hasTarget":true}, "risky"],
  "negCash": [{"startingCash":8000,"targetProfit":2000,"hasTarget":true,"revenue":12000,"rent":3000,"wages":5000,"supplies":1000,"utilities":400,"marketing":800,"other":300,"equipment":9000,"inventory":4000,"otherStartup":1500}, {"totalExpenses":10500,"expectedProfit":1500,"targetGap":500,"startupPurchases":14500,"cashLeft":-5000,"hasTarget":true}, "veryRisky"],
  "negCashLoss": [{"startingCash":5000,"hasTarget":false,"revenue":4000,"rent":2500,"wages":3000,"supplies":600,"utilities":300,"marketing":300,"other":200,"equipment":4000,"inventory":1500}, {"totalExpenses":6900,"expectedProfit":-2900,"targetGap":2900,"startupPurchases":5500,"cashLeft":-3400,"hasTarget":false}, "veryRisky"],
  "optionalBlank": [{"startingCash":3000,"hasTarget":false,"revenue":2500}, {"totalExpenses":0,"expectedProfit":2500,"targetGap":-2500,"startupPurchases":0,"cashLeft":5500,"hasTarget":false}, null],
  "optionalZero": [{"startingCash":3000,"hasTarget":false,"revenue":2500,"rent":0,"wages":0,"supplies":0,"utilities":0,"marketing":0,"other":0,"equipment":0,"inventory":0,"otherStartup":0}, {"totalExpenses":0,"expectedProfit":2500,"targetGap":-2500,"startupPurchases":0,"cashLeft":5500,"hasTarget":false}, null],
  "zeroRevenue": [{"startingCash":6000,"hasTarget":false,"revenue":0,"rent":800,"wages":0,"supplies":0,"utilities":0,"marketing":0,"other":0,"equipment":1000}, {"totalExpenses":800,"expectedProfit":-800,"targetGap":800,"startupPurchases":1000,"cashLeft":4200,"hasTarget":false}, "healthy"],
  "cents": [{"startingCash":10000.5,"targetProfit":1234.56,"hasTarget":true,"revenue":7777.77,"rent":1234.12,"wages":2000,"supplies":333.33,"utilities":100,"marketing":50.5,"other":10,"equipment":2500.25,"inventory":999.99,"otherStartup":12.34}, {"totalExpenses":3727.95,"expectedProfit":4049.8200000000006,"targetGap":-2815.2600000000007,"startupPurchases":3512.58,"cashLeft":10537.740000000002,"hasTarget":true}, "watch"],
  "tightCash": [{"startingCash":10000,"hasTarget":false,"revenue":9000,"rent":2000,"wages":3000,"supplies":800,"utilities":300,"marketing":300,"other":200,"equipment":6500,"inventory":1500}, {"totalExpenses":6600,"expectedProfit":2400,"targetGap":-2400,"startupPurchases":8000,"cashLeft":4400,"hasTarget":false}, "risky"],

};

Object.keys(PINNED).forEach(function (name) {
  test("pinned result is unchanged: " + name, function () {
    var input = PINNED[name][0];
    var r = plan(input);
    assert.deepStrictEqual(r, PINNED[name][1]);
    // Estimated cash left still reconciles step by step.
    assert.strictEqual(r.cashLeft, (input.startingCash || 0) - r.startupPurchases + r.expectedProfit);
    var u = usage(r.startupPurchases, input.startingCash);
    assert.strictEqual(u ? u.band : null, PINNED[name][2]);
  });
});

console.log("All " + passed + " tests passed.");
