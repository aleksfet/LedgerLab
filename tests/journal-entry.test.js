/* ============================================================
   Tests for journal-entry.js — run with: node tests/journal-entry.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */

"use strict";

var assert = require("assert");
var JE = require("../journal-entry.js");

var ACCOUNTS = JE.ACCOUNTS;
var TRANSACTIONS = JE.TRANSACTIONS;
var accountEffect = JE.accountEffect;
var buildEntry = JE.buildEntry;

var passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}

// Expected debit/credit account NAMES per the approved spec mapping.
var EXPECTED = {
  "owner-invest": { debit: "Cash", credit: "Owner's Capital" },
  "buy-equipment": { debit: "Equipment", credit: "Cash" },
  "buy-supplies": { debit: "Supplies", credit: "Cash" },
  "pay-rent": { debit: "Rent Expense", credit: "Cash" },
  "pay-wages": { debit: "Wages Expense", credit: "Cash" },
  "revenue-cash": { debit: "Cash", credit: "Service Revenue" },
  "revenue-account": { debit: "Accounts Receivable", credit: "Service Revenue" },
  "collect-ar": { debit: "Cash", credit: "Accounts Receivable" },
  "record-depreciation": {
    debit: "Depreciation Expense",
    credit: "Accumulated Depreciation",
  },
  "owner-withdraw": { debit: "Owner's Drawings", credit: "Cash" },
};

console.log("journal-entry.js");

// --- There are exactly the 10 approved transactions ---
test("exactly 10 transactions", function () {
  assert.strictEqual(TRANSACTIONS.length, 10);
});

// --- Balance invariant: debit total === credit total === amount, for all ---
test("every transaction builds a balanced two-line entry", function () {
  TRANSACTIONS.forEach(function (tx) {
    var entry = buildEntry(tx.id, 1234.56, "2026-06-25");
    assert.ok(entry, "entry built for " + tx.id);
    assert.strictEqual(entry.debit.amount, 1234.56, tx.id + " debit amount");
    assert.strictEqual(entry.credit.amount, 1234.56, tx.id + " credit amount");
    assert.strictEqual(entry.totals.debit, entry.totals.credit, tx.id + " totals equal");
    assert.strictEqual(entry.totals.balanced, true, tx.id + " balanced flag");
    assert.strictEqual(entry.lines.length, 2, tx.id + " has two lines");
  });
});

// --- Mapping correctness: debit/credit names match the approved table ---
test("debit/credit account names match the approved mapping", function () {
  TRANSACTIONS.forEach(function (tx) {
    var entry = buildEntry(tx.id, 100, "2026-06-25");
    var expected = EXPECTED[tx.id];
    assert.ok(expected, "expected mapping exists for " + tx.id);
    assert.strictEqual(entry.debit.name, expected.debit, tx.id + " debit name");
    assert.strictEqual(entry.credit.name, expected.credit, tx.id + " credit name");
  });
});

// --- accountEffect: the debit/credit rule for normal accounts ---
test("accountEffect applies the debit/credit rule for normal accounts", function () {
  // Asset debited -> increases; Asset credited -> decreases
  assert.strictEqual(accountEffect("cash", "debit").direction, "increases");
  assert.strictEqual(accountEffect("cash", "credit").direction, "decreases");
  // Equity credited -> increases; Equity debited -> decreases
  assert.strictEqual(accountEffect("ownersCapital", "credit").direction, "increases");
  assert.strictEqual(accountEffect("ownersCapital", "debit").direction, "decreases");
  // Revenue credited -> increases
  assert.strictEqual(accountEffect("serviceRevenue", "credit").direction, "increases");
  // Expense debited -> increases
  assert.strictEqual(accountEffect("rentExpense", "debit").direction, "increases");
  // none of the above are contra
  assert.strictEqual(accountEffect("cash", "debit").isContra, false);
});

// --- Contra handling: economic effect + note, not the raw rule ---
test("contra accounts report economic effect and a note", function () {
  // Accumulated Depreciation credited -> book value of the asset DECREASES
  var ad = accountEffect("accumDepreciation", "credit");
  assert.strictEqual(ad.isContra, true);
  assert.strictEqual(ad.elementLabel, "Asset");
  assert.strictEqual(ad.direction, "decreases");
  assert.ok(ad.note && ad.note.indexOf("contra-asset") !== -1, "accumDep note mentions contra-asset");

  // Owner's Drawings debited -> owner's EQUITY decreases
  var dr = accountEffect("ownersDrawings", "debit");
  assert.strictEqual(dr.isContra, true);
  assert.strictEqual(dr.elementLabel, "Equity");
  assert.strictEqual(dr.direction, "decreases");
  assert.ok(dr.note && dr.note.indexOf("contra-equity") !== -1, "drawings note mentions contra-equity");
});

// --- Narration present and non-empty for every transaction ---
test("every transaction has a non-empty narration", function () {
  TRANSACTIONS.forEach(function (tx) {
    assert.strictEqual(typeof tx.narration, "string", tx.id + " narration is a string");
    assert.ok(tx.narration.trim().length > 0, tx.id + " narration non-empty");
  });
});

// --- Every referenced account key exists in the chart of accounts ---
test("all transaction account keys exist in ACCOUNTS", function () {
  TRANSACTIONS.forEach(function (tx) {
    assert.ok(ACCOUNTS[tx.debit], tx.id + " debit key exists: " + tx.debit);
    assert.ok(ACCOUNTS[tx.credit], tx.id + " credit key exists: " + tx.credit);
  });
});

// --- Unknown transaction id returns null ---
test("buildEntry returns null for an unknown transaction id", function () {
  assert.strictEqual(buildEntry("does-not-exist", 100, "2026-06-25"), null);
});

console.log("\nAll " + passed + " tests passed.");
