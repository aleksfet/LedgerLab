/* ============================================================
   Tests for depreciation.js
   Run with: node tests/depreciation.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */

"use strict";

var assert = require("assert");
var DEP = require("../depreciation.js");
var calc = DEP.calculateDepreciation;

var passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}

console.log("depreciation.js");

test("clean example: annual and monthly straight-line amounts", function () {
  // (10000 - 1000) / 3 = 3000/yr; 3000/12 = 250/mo
  var r = calc({ name: "Van", cost: 10000, salvage: 1000, usefulLife: 3 });
  assert.strictEqual(r.depreciableBase, 9000);
  assert.strictEqual(r.annual, 3000);
  assert.strictEqual(r.monthly, 250);
  assert.strictEqual(r.method, "Straight-Line");
});

test("schedule length equals useful life", function () {
  var r = calc({ name: "Van", cost: 10000, salvage: 1000, usefulLife: 5 });
  assert.strictEqual(r.schedule.length, 5);
  assert.strictEqual(r.schedule[0].year, 1);
  assert.strictEqual(r.schedule[4].year, 5);
});

test("book value ends exactly at salvage; accumulated equals base", function () {
  var r = calc({ name: "Van", cost: 10000, salvage: 1000, usefulLife: 3 });
  var last = r.schedule[r.schedule.length - 1];
  assert.strictEqual(last.bookValue, 1000, "ends at salvage");
  assert.strictEqual(last.accumulated, 9000, "accumulated equals depreciable base");
});

test("first-year schedule row is correct", function () {
  var r = calc({ name: "Van", cost: 10000, salvage: 1000, usefulLife: 3 });
  var first = r.schedule[0];
  assert.strictEqual(first.expense, 3000);
  assert.strictEqual(first.accumulated, 3000);
  assert.strictEqual(first.bookValue, 7000);
});

test("rounding case (10000/0/3): final year trues up to book value 0", function () {
  // 10000/3 = 3333.33; years 1-2 = 3333.33; final = 9999.99... trued up so book value = 0
  var r = calc({ name: "Machine", cost: 10000, salvage: 0, usefulLife: 3 });
  assert.strictEqual(r.annual, 3333.33);
  assert.strictEqual(r.schedule[0].expense, 3333.33);
  assert.strictEqual(r.schedule[1].expense, 3333.33);
  // final expense = 10000 - 3333.33*2 = 3333.34
  assert.strictEqual(r.schedule[2].expense, 3333.34);
  assert.strictEqual(r.schedule[2].bookValue, 0, "book value ends exactly at 0");
  assert.strictEqual(r.schedule[2].accumulated, 10000);
});

test("useful life of 1: single full-base year ending at salvage", function () {
  var r = calc({ name: "Tablet", cost: 800, salvage: 200, usefulLife: 1 });
  assert.strictEqual(r.schedule.length, 1);
  assert.strictEqual(r.schedule[0].expense, 600);
  assert.strictEqual(r.schedule[0].bookValue, 200);
});

test("journal entry: DR Depreciation Expense / CR Accumulated Depreciation = annual", function () {
  var r = calc({ name: "Van", cost: 10000, salvage: 1000, usefulLife: 3 });
  assert.strictEqual(r.journal.debit, "Depreciation Expense");
  assert.strictEqual(r.journal.credit, "Accumulated Depreciation");
  assert.strictEqual(r.journal.amount, 3000);
});

test("invalid inputs return null", function () {
  assert.strictEqual(calc({ cost: 0, salvage: 0, usefulLife: 3 }), null, "cost must be > 0");
  assert.strictEqual(calc({ cost: 1000, salvage: 1000, usefulLife: 3 }), null, "salvage must be < cost");
  assert.strictEqual(calc({ cost: 1000, salvage: 2000, usefulLife: 3 }), null, "salvage above cost");
  assert.strictEqual(calc({ cost: 1000, salvage: 100, usefulLife: 0 }), null, "life must be >= 1");
  assert.strictEqual(calc({ cost: 1000, salvage: 100, usefulLife: 2.5 }), null, "life must be a whole number");
});

console.log("\nAll " + passed + " tests passed.");
