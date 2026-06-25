/* ============================================================
   Tests for bank-reconciliation.js
   Run with: node tests/bank-reconciliation.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */

"use strict";

var assert = require("assert");
var BR = require("../bank-reconciliation.js");

var passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}

console.log("bank-reconciliation.js");

// A classic reconciled example:
//   Bank: 5000 + 800 (deposits) - 1200 (checks) = 4600
//   Book: 4650 + 50 (interest) - 100 (fees)     = 4600
var RECONCILED = {
  bankBalance: 5000,
  bookBalance: 4650,
  depositsInTransit: 800,
  outstandingChecks: 1200,
  interestEarned: 50,
  bankServiceFees: 100,
  errorAmount: 0,
  errorSide: "bank",
  errorDirection: "increase",
};

test("reconciled example: both sides equal, reconciled true", function () {
  var r = BR.reconcile(RECONCILED);
  assert.strictEqual(r.bank.adjusted, 4600, "adjusted bank");
  assert.strictEqual(r.book.adjusted, 4600, "adjusted book");
  assert.strictEqual(r.reconciled, true, "reconciled");
  assert.strictEqual(Math.abs(r.difference) < 0.005, true, "difference ~ 0");
});

test("non-reconciled example: reports the difference", function () {
  var inputs = Object.assign({}, RECONCILED, { outstandingChecks: 1000 }); // bank +200
  var r = BR.reconcile(inputs);
  assert.strictEqual(r.bank.adjusted, 4800);
  assert.strictEqual(r.book.adjusted, 4600);
  assert.strictEqual(r.reconciled, false);
  assert.strictEqual(r.difference, 200);
});

test("error applies only to the chosen side and direction (bank, decrease)", function () {
  var inputs = Object.assign({}, RECONCILED, {
    errorAmount: 200,
    errorSide: "bank",
    errorDirection: "decrease",
  });
  var r = BR.reconcile(inputs);
  // Bank drops by 200 -> 4400; book unchanged at 4600.
  assert.strictEqual(r.bank.adjusted, 4400, "bank reduced by error");
  assert.strictEqual(r.book.adjusted, 4600, "book unaffected");
  assert.strictEqual(r.difference, -200);
});

test("error applies only to the chosen side and direction (book, increase)", function () {
  var inputs = Object.assign({}, RECONCILED, {
    errorAmount: 200,
    errorSide: "book",
    errorDirection: "increase",
  });
  var r = BR.reconcile(inputs);
  assert.strictEqual(r.bank.adjusted, 4600, "bank unaffected");
  assert.strictEqual(r.book.adjusted, 4800, "book raised by error");
  assert.strictEqual(r.difference, -200);
});

test("blank / missing adjustments are treated as 0", function () {
  var r = BR.reconcile({ bankBalance: 1000, bookBalance: 1000 });
  assert.strictEqual(r.bank.adjusted, 1000);
  assert.strictEqual(r.book.adjusted, 1000);
  assert.strictEqual(r.reconciled, true);
  // Only the starting balance line should appear when nothing else is entered.
  assert.strictEqual(r.bank.lines.length, 1, "bank has only the start line");
  assert.strictEqual(r.book.lines.length, 1, "book has only the start line");
});

test("zero-amount adjustment lines are hidden; non-zero ones appear", function () {
  var r = BR.reconcile({
    bankBalance: 1000,
    bookBalance: 1000,
    depositsInTransit: 250,
  });
  // start + deposits in transit
  assert.strictEqual(r.bank.lines.length, 2);
  assert.strictEqual(r.bank.lines[1].label, "Deposits in transit");
  assert.strictEqual(r.bank.lines[1].sign, "plus");
});

test("suggestedEntries: fees -> DR Bank Service Charge Expense / CR Cash", function () {
  var list = BR.suggestedEntries({ bankBalance: 1, bookBalance: 1, bankServiceFees: 100 });
  var fees = list.find(function (e) { return e.item === "Bank service fees"; });
  assert.ok(fees, "fees entry present");
  assert.strictEqual(fees.needsEntry, true);
  assert.strictEqual(fees.debit, "Bank Service Charge Expense");
  assert.strictEqual(fees.credit, "Cash");
  assert.strictEqual(fees.amount, 100);
});

test("suggestedEntries: interest -> DR Cash / CR Interest Revenue", function () {
  var list = BR.suggestedEntries({ bankBalance: 1, bookBalance: 1, interestEarned: 50 });
  var interest = list.find(function (e) { return e.item === "Interest earned"; });
  assert.ok(interest);
  assert.strictEqual(interest.debit, "Cash");
  assert.strictEqual(interest.credit, "Interest Revenue");
});

test("suggestedEntries: book error direction sets the correcting entry", function () {
  var inc = BR.suggestedEntries({
    bankBalance: 1, bookBalance: 1,
    errorAmount: 75, errorSide: "book", errorDirection: "increase",
  }).find(function (e) { return e.item === "Book error"; });
  assert.strictEqual(inc.debit, "Cash");
  assert.strictEqual(inc.credit, "Misstated account");

  var dec = BR.suggestedEntries({
    bankBalance: 1, bookBalance: 1,
    errorAmount: 75, errorSide: "book", errorDirection: "decrease",
  }).find(function (e) { return e.item === "Book error"; });
  assert.strictEqual(dec.debit, "Misstated account");
  assert.strictEqual(dec.credit, "Cash");
});

test("suggestedEntries: bank-side items need no entry", function () {
  var list = BR.suggestedEntries({
    bankBalance: 1, bookBalance: 1,
    depositsInTransit: 100, outstandingChecks: 200,
    errorAmount: 30, errorSide: "bank", errorDirection: "increase",
  });
  ["Deposits in transit", "Outstanding checks", "Bank error"].forEach(function (name) {
    var e = list.find(function (x) { return x.item === name; });
    assert.ok(e, name + " present");
    assert.strictEqual(e.needsEntry, false, name + " needs no entry");
  });
});

console.log("\nAll " + passed + " tests passed.");
