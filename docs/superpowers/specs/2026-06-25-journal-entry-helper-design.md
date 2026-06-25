# Journal Entry Helper — v1 Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorming complete)
**Scope:** First Accounting Tool in LedgerLab. Reveal-only, single two-line journal entries.

---

## 1. Goal

Help beginners understand how common business transactions become journal entries.
A user picks a transaction, enters one amount, and the tool reveals:

- The debit account and credit account (with amounts).
- A plain-English + rules-based explanation (account types, increase/decrease, the debit/credit rule).
- A clean, textbook-style general-journal preview (editable date, indented credit, narration, totals row, balance confirmation).

This is **reveal only** — no quiz/practice mode in v1.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Interaction model | Reveal only (pick transaction + amount → see the entry) |
| Entry structure | Simple two-line entries: exactly one debit + one credit, both equal to the entered amount. Always balances by construction. |
| Explanation depth | Plain-English **+** account types (Asset/Liability/Equity/Revenue/Expense) **+** up/down direction **+** the debit/credit rule |
| Placement | First real tool inside the existing `#tools` "Accounting Tools" section (replaces the "Coming soon" placeholder). Nav unchanged. |
| Layout | Two-panel (controls left, output right), reusing the Business Simulator structure; stacks to one column on mobile |
| Preview style | Realistic general-journal: editable date, indented credit, narration line, totals row showing debits = credits |
| Structure | Data-driven (Approach 1): a chart-of-accounts map + a transactions list + pure render functions |
| Terminology | Proprietorship-consistent: **Owner's Capital** / **Owner's Drawings** (no corporation terms) |

**Out of scope for v1 (do not build):** quiz/practice mode, multi-line/split entries, accounting-equation panel, running journal/ledger, posting/reference columns, persistence.

---

## 3. Placement & UX flow

- Replace the placeholder inside `#tools` with the Journal Entry Helper as the first tool. Keep the "Accounting Tools" section heading (umbrella for future tools; nav already points at `#tools`).
- **Left panel (controls):** transaction `<select>` · amount (money input) · editable date (defaults to today) · "Show Journal Entry" + "Reset" buttons.
- **Right panel (output):** empty state before first run → on Show, the general-journal preview + narration + explanation panel.
- Changing inputs and pressing Show re-renders. Single entry at a time; no persistence.

**Reused components/styles:** `sim-layout`, `sim-panel`, `field` / `money-input`, `sim-empty` / `sim-dashboard`, `preview-card` / `preview-table`, `explanation` / `explanation-list`, `.btn`. Only minimal new CSS (account-type badges + small spacing).

**Do not change** any homepage section outside `#tools`.

---

## 4. Data model

Two structures are the single source of truth. Account **type** and **direction** are derived from the
referenced account, never re-typed per transaction, so the data cannot contradict itself.

### 4.1 Chart of accounts

```js
ACCOUNTS = {
  cash:                { name: "Cash",                     type: "Asset",          normalSide: "debit"  },
  accountsReceivable:  { name: "Accounts Receivable",      type: "Asset",          normalSide: "debit"  },
  supplies:            { name: "Supplies",                 type: "Asset",          normalSide: "debit"  },
  equipment:           { name: "Equipment",                type: "Asset",          normalSide: "debit"  },
  accumDepreciation:   { name: "Accumulated Depreciation", type: "Contra-Asset",   normalSide: "credit",
                         contra: true,
                         note: "Accumulated Depreciation is a contra-asset account that lowers the book value of equipment." },
  ownersCapital:       { name: "Owner's Capital",          type: "Equity",         normalSide: "credit" },
  ownersDrawings:      { name: "Owner's Drawings",         type: "Equity (Drawings)", normalSide: "debit",
                         contra: true,
                         note: "Owner's Drawings is a contra-equity account; withdrawing cash reduces the owner's equity." },
  serviceRevenue:      { name: "Service Revenue",          type: "Revenue",        normalSide: "credit" },
  rentExpense:         { name: "Rent Expense",             type: "Expense",        normalSide: "debit"  },
  wagesExpense:        { name: "Wages Expense",            type: "Expense",        normalSide: "debit"  },
  depreciationExpense: { name: "Depreciation Expense",     type: "Expense",        normalSide: "debit"  },
}
```

### 4.2 Transactions

```js
TRANSACTIONS = [
  { id, label, debit: <accountKey>, credit: <accountKey>, narration }
]
```

### 4.3 Approved mapping (the accounting to preserve)

| # | id | Transaction (label) | Debit | Credit | Narration |
|---|---|---|---|---|---|
| 1 | owner-invest | Owner invested cash | Cash (Asset ↑) | Owner's Capital (Equity ↑) | Owner invested cash into the business. |
| 2 | buy-equipment | Bought equipment with cash | Equipment (Asset ↑) | Cash (Asset ↓) | Purchased equipment for cash. |
| 3 | buy-supplies | Bought supplies with cash | Supplies (Asset ↑) | Cash (Asset ↓) | Purchased supplies for cash. |
| 4 | pay-rent | Paid rent | Rent Expense (Expense ↑) | Cash (Asset ↓) | Paid rent for the month. |
| 5 | pay-wages | Paid wages | Wages Expense (Expense ↑) | Cash (Asset ↓) | Paid employee wages. |
| 6 | revenue-cash | Earned service revenue for cash | Cash (Asset ↑) | Service Revenue (Revenue ↑) | Earned service revenue, received in cash. |
| 7 | revenue-account | Earned service revenue on account | Accounts Receivable (Asset ↑) | Service Revenue (Revenue ↑) | Earned service revenue on account, to be collected later. |
| 8 | collect-ar | Collected cash from customer | Cash (Asset ↑) | Accounts Receivable (Asset ↓) | Collected cash from a customer on account. |
| 9 | record-depreciation | Recorded depreciation | Depreciation Expense (Expense ↑) | Accumulated Depreciation *(contra-asset)* | Recorded depreciation for the period. |
| 10 | owner-withdraw | Owner withdrew cash | Owner's Drawings *(reduces equity)* | Cash (Asset ↓) | Owner withdrew cash from the business. |

---

## 5. Rendering & explanation logic

### 5.1 Pure functions (no DOM — unit-testable in Node)

- `accountEffect(accountKey, side)` → `{ name, type, elementLabel, direction, isContra, note? }`
  - **Normal accounts:** `direction = (side === normalSide) ? "increases" : "decreases"` on the account's element.
  - **Contra accounts (`contra: true`):** do **not** apply the raw rule; return the element-level economic effect and the `note`
    (Accumulated Depreciation → lowers equipment book value; Owner's Drawings → reduces owner's equity).
- `buildEntry(transactionId, amount, date)` → view-model:
  ```
  {
    date, label, narration,
    debit:  { name, amount },
    credit: { name, amount },
    totals: { debit: amount, credit: amount, balanced: true },
    lines: [ accountEffect(debit, "debit"), accountEffect(credit, "credit") ]
  }
  ```

`buildEntry` always produces `debit.amount === credit.amount === amount` (two-line, balanced by construction).

### 5.2 DOM rendering (separate from the pure logic)

On **Show Journal Entry** (after validation):

1. **General-journal preview** (`preview-card` / `preview-table`):
   - Header echoes the **date** + transaction label.
   - Debit row: debit account name, amount in Debit column.
   - Credit row: credit account name **indented**, amount in Credit column.
   - **Totals row:** Debit total and Credit total (equal).
   - **Balance line:** "This entry balances because total debits equal total credits ($X = $X)."
2. **Narration** line beneath the table (italic).
3. **Explanation panel** (`explanation` style):
   - Two account rows: name + **type badge** (color-coded by element) + ↑/↓ direction (or contra economic effect).
   - **Rule line** (always): "Debits increase assets and expenses; credits increase liabilities, equity, and revenue."
   - **Plain-English sentence** for the transaction.
   - **Contra `note`** when present.

---

## 6. Edge cases & validation

- **Amount** (validated, reuses existing red-border/message UI):
  - Blank → "Enter an amount."
  - Invalid/non-numeric → "Enter a valid number."
  - `≤ 0` → "Enter an amount greater than 0." (stricter than the simulator's `≥ 0`, intentional).
  - Reuses the existing money-input sanitizer (blocks `e/E/+/-`, strips non-digits, one decimal). Live-clears on fix.
- **Transaction selector:** defaults to a disabled "Choose a transaction…" option; Show without a choice → "Choose a transaction."
- **Date:** defaults to today, editable, **no validation**; if cleared, the preview falls back to today for the echo.
- **Re-run:** changing inputs + Show re-renders the latest entry.
- **Reset:** amount cleared, select back to placeholder, date back to today, output → empty state, errors cleared.
- **Refresh / bfcache:** clears amount, resets select + date, returns to empty state — folded into the existing on-load reset pattern.
- **Formatting:** amounts via existing `formatMoney` (comma grouping, 2 decimals).

---

## 7. Testing approach

Dependency-free; no external libraries.

1. **`journal-entry.js`** holds `ACCOUNTS`, `TRANSACTIONS`, `accountEffect`, `buildEntry`, with a dual-export guard
   (`if (typeof module !== "undefined") module.exports = {...}`) so the same file runs in the browser and in Node.
2. **`tests/journal-entry.test.js`** (run `node tests/journal-entry.test.js`, built-in `assert` only):
   - Balance invariant: all 10 transactions → debit total === credit total === amount.
   - Mapping correctness: debit/credit account names match the approved table.
   - `accountEffect` rules: Asset+debit→increases, Asset+credit→decreases, Equity+credit→increases, Revenue+credit→increases, Expense+debit→increases.
   - Contra handling: `accumDepreciation` & `ownersDrawings` → `isContra: true` + economic-effect note.
   - Narration present and non-empty for every transaction.
3. **Manual browser checklist:** preview/indented-credit/totals/balance-line rendering, validation messages, reset, refresh/bfcache clearing, two-panel→stacked responsiveness, dark-mode badge styling.

---

## 8. Files expected to change

- **New:** `journal-entry.js` (data + pure logic), `tests/journal-entry.test.js`, this spec doc.
- **Edit:** `index.html` (`#tools` section only — replace placeholder with the tool; add `<script src="journal-entry.js">`), `script.js` (JE init + DOM rendering, wired into existing load/reset), `styles.css` (account-type badges + minor spacing).

No homepage sections outside `#tools` change. No new features beyond Journal Entry Helper v1.
