/* ============================================================
   LedgerLab — journal-entry.js
   Data + pure accounting logic for the Journal Entry Helper (v1).
   No DOM here: this module is unit-testable in Node and also
   attaches to window.JournalEntry for the browser.
   Reveal-only, simple two-line entries (one debit, one credit,
   both equal to the entered amount — always balanced).
   ============================================================ */

(function (root) {
  "use strict";

  /**
   * Chart of accounts. Each account is the single source of truth for its
   * type and normal balance side. Direction (increase/decrease) is derived,
   * never re-typed per transaction.
   *
   * Contra accounts carry `contra: true`, the associated `element`, and a
   * beginner-friendly `note`. For them we describe the economic effect on the
   * 5 elements rather than the raw debit/credit rule.
   */
  var ACCOUNTS = {
    cash: { name: "Cash", type: "Asset", normalSide: "debit" },
    accountsReceivable: {
      name: "Accounts Receivable",
      type: "Asset",
      normalSide: "debit",
    },
    supplies: { name: "Supplies", type: "Asset", normalSide: "debit" },
    equipment: { name: "Equipment", type: "Asset", normalSide: "debit" },
    accumDepreciation: {
      name: "Accumulated Depreciation",
      type: "Contra-Asset",
      normalSide: "credit",
      contra: true,
      element: "Asset",
      note:
        "Accumulated Depreciation is a contra-asset account that lowers the " +
        "book value of equipment.",
    },
    ownersCapital: {
      name: "Owner's Capital",
      type: "Equity",
      normalSide: "credit",
    },
    ownersDrawings: {
      name: "Owner's Drawings",
      type: "Equity (Drawings)",
      normalSide: "debit",
      contra: true,
      element: "Equity",
      note:
        "Owner's Drawings is a contra-equity account; withdrawing cash " +
        "reduces the owner's equity.",
    },
    serviceRevenue: {
      name: "Service Revenue",
      type: "Revenue",
      normalSide: "credit",
    },
    rentExpense: { name: "Rent Expense", type: "Expense", normalSide: "debit" },
    wagesExpense: {
      name: "Wages Expense",
      type: "Expense",
      normalSide: "debit",
    },
    depreciationExpense: {
      name: "Depreciation Expense",
      type: "Expense",
      normalSide: "debit",
    },
  };

  /**
   * The ten supported transactions. Each is a simple two-line entry referencing
   * accounts by key. Amounts come from the single amount the user enters.
   */
  var TRANSACTIONS = [
    {
      id: "owner-invest",
      label: "Owner invested cash",
      debit: "cash",
      credit: "ownersCapital",
      narration: "Owner invested cash into the business.",
    },
    {
      id: "buy-equipment",
      label: "Bought equipment with cash",
      debit: "equipment",
      credit: "cash",
      narration: "Purchased equipment for cash.",
    },
    {
      id: "buy-supplies",
      label: "Bought supplies with cash",
      debit: "supplies",
      credit: "cash",
      narration: "Purchased supplies for cash.",
    },
    {
      id: "pay-rent",
      label: "Paid rent",
      debit: "rentExpense",
      credit: "cash",
      narration: "Paid rent for the month.",
    },
    {
      id: "pay-wages",
      label: "Paid wages",
      debit: "wagesExpense",
      credit: "cash",
      narration: "Paid employee wages.",
    },
    {
      id: "revenue-cash",
      label: "Earned service revenue for cash",
      debit: "cash",
      credit: "serviceRevenue",
      narration: "Earned service revenue, received in cash.",
    },
    {
      id: "revenue-account",
      label: "Earned service revenue on account",
      debit: "accountsReceivable",
      credit: "serviceRevenue",
      narration: "Earned service revenue on account, to be collected later.",
    },
    {
      id: "collect-ar",
      label: "Collected cash from customer",
      debit: "cash",
      credit: "accountsReceivable",
      narration: "Collected cash from a customer on account.",
    },
    {
      id: "record-depreciation",
      label: "Recorded depreciation",
      debit: "depreciationExpense",
      credit: "accumDepreciation",
      narration: "Recorded depreciation for the period.",
    },
    {
      id: "owner-withdraw",
      label: "Owner withdrew cash",
      debit: "ownersDrawings",
      credit: "cash",
      narration: "Owner withdrew cash from the business.",
    },
  ];

  /** Look up a transaction record by id (or null). */
  function getTransaction(transactionId) {
    for (var i = 0; i < TRANSACTIONS.length; i++) {
      if (TRANSACTIONS[i].id === transactionId) return TRANSACTIONS[i];
    }
    return null;
  }

  /**
   * Describe what a posting does to an account.
   * @param {string} accountKey - key into ACCOUNTS
   * @param {string} side - "debit" or "credit"
   * @returns {{key,name,type,side,elementLabel,direction,isContra,note}|null}
   *
   * Normal accounts: increases when posted on their normal side, else decreases.
   * Contra accounts: report the economic effect on the underlying element
   * (which is the opposite of the contra balance movement) plus the note.
   */
  function accountEffect(accountKey, side) {
    var account = ACCOUNTS[accountKey];
    if (!account) return null;

    if (account.contra) {
      var balanceIncreases = side === account.normalSide;
      return {
        key: accountKey,
        name: account.name,
        type: account.type,
        side: side,
        elementLabel: account.element,
        // Contra flips: when the contra balance goes up, its element goes down.
        direction: balanceIncreases ? "decreases" : "increases",
        isContra: true,
        note: account.note,
      };
    }

    var increases = side === account.normalSide;
    return {
      key: accountKey,
      name: account.name,
      type: account.type,
      side: side,
      elementLabel: account.type,
      direction: increases ? "increases" : "decreases",
      isContra: false,
      note: null,
    };
  }

  /**
   * Build the view-model for a transaction at a given amount and date.
   * Always produces a balanced two-line entry (debit amount === credit amount).
   * @returns {object|null} null if the transaction id is unknown.
   */
  function buildEntry(transactionId, amount, date) {
    var tx = getTransaction(transactionId);
    if (!tx) return null;

    var amt = Number(amount);
    if (isNaN(amt)) amt = 0;

    return {
      id: tx.id,
      label: tx.label,
      narration: tx.narration,
      date: date,
      debit: { key: tx.debit, name: ACCOUNTS[tx.debit].name, amount: amt },
      credit: { key: tx.credit, name: ACCOUNTS[tx.credit].name, amount: amt },
      totals: { debit: amt, credit: amt, balanced: true },
      lines: [
        accountEffect(tx.debit, "debit"),
        accountEffect(tx.credit, "credit"),
      ],
    };
  }

  var api = {
    ACCOUNTS: ACCOUNTS,
    TRANSACTIONS: TRANSACTIONS,
    getTransaction: getTransaction,
    accountEffect: accountEffect,
    buildEntry: buildEntry,
  };

  // Dual export: Node (tests) + browser (window.JournalEntry). No libraries.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.JournalEntry = api;
  }
})(typeof self !== "undefined" ? self : this);
