/* ============================================================
   LedgerLab — bank-reconciliation.js
   Data + pure logic for the Bank Reconciliation Helper (v1).
   No DOM here: unit-testable in Node and also attaches to
   window.BankReconciliation for the browser.

   Model:
     Adjusted bank = bank statement + deposits in transit
                     - outstanding checks +/- bank error
     Adjusted book = book cash + interest earned
                     - bank service fees +/- book error
   The optional error applies to ONE chosen side (bank|book) in
   one direction (increase|decrease). Reconciled when the two
   adjusted balances are equal (within a rounding epsilon).
   ============================================================ */

(function (root) {
  "use strict";

  var EPSILON = 0.005;

  /** Coerce a value to a non-negative number; blank/invalid -> 0. */
  function num(value) {
    var n = Number(value);
    if (isNaN(n) || !isFinite(n) || n < 0) return 0;
    return n;
  }

  /**
   * Signed error amount for a given side.
   * Returns 0 unless the error targets this side and amount > 0.
   */
  function errorFor(side, inputs) {
    var amount = num(inputs.errorAmount);
    if (amount <= 0) return 0;
    if (inputs.errorSide !== side) return 0;
    return inputs.errorDirection === "decrease" ? -amount : amount;
  }

  /**
   * Build a side's statement: starting balance + only the non-zero
   * adjustment lines, then the adjusted total.
   * @returns {{lines: Array, adjusted: number}}
   */
  function buildSide(startLabel, startAmount, adjustments) {
    var lines = [{ label: startLabel, amount: startAmount, sign: "start" }];
    var adjusted = startAmount;

    adjustments.forEach(function (adj) {
      if (adj.amount === 0) return; // hide zero lines for a clean report
      lines.push({ label: adj.label, amount: adj.amount, sign: adj.sign });
      adjusted += adj.sign === "minus" ? -adj.amount : adj.amount;
    });

    return { lines: lines, adjusted: adjusted };
  }

  /**
   * Reconcile book vs. bank.
   * @param {object} inputs
   * @returns {{bank, book, reconciled, difference}}
   */
  function reconcile(inputs) {
    inputs = inputs || {};

    var bankError = errorFor("bank", inputs);
    var bookError = errorFor("book", inputs);

    var bank = buildSide("Bank statement balance", num(inputs.bankBalance), [
      { label: "Deposits in transit", amount: num(inputs.depositsInTransit), sign: "plus" },
      { label: "Outstanding checks", amount: num(inputs.outstandingChecks), sign: "minus" },
      {
        label: "Bank error",
        amount: Math.abs(bankError),
        sign: bankError < 0 ? "minus" : "plus",
      },
    ]);

    var book = buildSide("Book cash balance", num(inputs.bookBalance), [
      { label: "Interest earned", amount: num(inputs.interestEarned), sign: "plus" },
      { label: "Bank service fees", amount: num(inputs.bankServiceFees), sign: "minus" },
      {
        label: "Book error",
        amount: Math.abs(bookError),
        sign: bookError < 0 ? "minus" : "plus",
      },
    ]);

    var difference = bank.adjusted - book.adjusted;

    return {
      bank: bank,
      book: book,
      reconciled: Math.abs(difference) < EPSILON,
      difference: difference,
    };
  }

  /**
   * Suggested journal entries for the entered adjustments.
   * Only book-side items need an entry; bank-side items are timing
   * differences or the bank's own correction.
   * @returns {Array<{item, needsEntry, debit?, credit?, amount, note}>}
   */
  function suggestedEntries(inputs) {
    inputs = inputs || {};
    var entries = [];

    var fees = num(inputs.bankServiceFees);
    if (fees > 0) {
      entries.push({
        item: "Bank service fees",
        needsEntry: true,
        debit: "Bank Service Charge Expense",
        credit: "Cash",
        amount: fees,
        note: "Fees lower your cash, so record them on your books.",
      });
    }

    var interest = num(inputs.interestEarned);
    if (interest > 0) {
      entries.push({
        item: "Interest earned",
        needsEntry: true,
        debit: "Cash",
        credit: "Interest Revenue",
        amount: interest,
        note: "Interest raises your cash, so record it on your books.",
      });
    }

    var bookError = errorFor("book", inputs);
    if (bookError !== 0) {
      var increasesCash = bookError > 0;
      entries.push({
        item: "Book error",
        needsEntry: true,
        debit: increasesCash ? "Cash" : "Misstated account",
        credit: increasesCash ? "Misstated account" : "Cash",
        amount: Math.abs(bookError),
        note:
          "A correcting entry fixes a mistake in your own records by " +
          (increasesCash ? "increasing" : "decreasing") +
          " Cash.",
      });
    }

    // Bank-side items: shown for learning, but no entry on your books.
    if (num(inputs.depositsInTransit) > 0) {
      entries.push({
        item: "Deposits in transit",
        needsEntry: false,
        amount: num(inputs.depositsInTransit),
        note: "Timing difference — it will clear once the bank records it. No entry.",
      });
    }
    if (num(inputs.outstandingChecks) > 0) {
      entries.push({
        item: "Outstanding checks",
        needsEntry: false,
        amount: num(inputs.outstandingChecks),
        note: "Timing difference — it will clear when the checks are cashed. No entry.",
      });
    }
    var bankError = errorFor("bank", inputs);
    if (bankError !== 0) {
      entries.push({
        item: "Bank error",
        needsEntry: false,
        amount: Math.abs(bankError),
        note: "The bank's mistake — contact the bank to fix it. No entry on your books.",
      });
    }

    return entries;
  }

  var api = {
    EPSILON: EPSILON,
    reconcile: reconcile,
    suggestedEntries: suggestedEntries,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BankReconciliation = api;
  }
})(typeof self !== "undefined" ? self : this);
