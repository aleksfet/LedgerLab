# Bank Reconciliation Helper — v1 Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorming complete)
**Scope:** Second Accounting Tool in LedgerLab. Compare book cash to the bank statement and find the adjusted cash balance.

---

## 1. Goal

Help beginners understand how a business reconciles its **book cash balance** with its **bank statement
balance** to find the correct adjusted cash balance. The user enters the two balances plus the common
reconciling items; the tool shows both adjusted balances, whether they reconcile, beginner-friendly
explanations, and the journal entries the book-side adjustments would require.

Mirrors the Journal Entry Helper's structure: a data-driven module with pure functions, a two-panel UI
inside the Accounting Tools section, and Node tests.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Error adjustment | One amount + a **side** (Bank/Book) + a **direction** (Increase/Decrease). Applied only to the chosen side. |
| Journal-entry note depth | Plain-English **+** the actual suggested DR/CR entry for each book-side item that needs one; bank-side items flagged "no entry needed." |
| Placement | Second tool inside the existing `#tools` "Accounting Tools" section, below the Journal Entry Helper. |
| Layout | Two-panel (inputs left, report right); stacks on mobile. Reuses existing components. |
| Structure | Data-driven: `bank-reconciliation.js` with pure `reconcile()` + `suggestedEntries()`; dual-export for browser + Node. |
| Balances | Required and ≥ 0 for v1 (no overdrafts) — kept beginner-friendly. |

**Out of scope for v1:** overdrafts / negative balances, NSF checks, multiple errors, saving/printing, posting the entries, equation view.

---

## 3. Reconciliation model & formulas

```
Adjusted BANK balance = Bank statement balance
                        + Deposits in transit
                        − Outstanding checks
                        ± Bank error        (only if error side = "bank")

Adjusted BOOK balance = Book cash balance
                        + Interest earned
                        − Bank service fees
                        ± Book error        (only if error side = "book")
```

- **Error:** amount (≥ 0) + side (Bank/Book) + direction (Increase → `+`, Decrease → `−`). Applied to the
  chosen side only; the other side's error term is 0. Only affects output when the amount > 0.
- **Reconciled?** `true` when `|Adjusted Bank − Adjusted Book| < 0.005` (rounding epsilon).
- **Difference** = `Adjusted Bank − Adjusted Book`, shown when not reconciled, with guidance to recheck the
  side that is off.

Standard placements (fixed): deposits in transit `+` bank; outstanding checks `−` bank; interest `+` book;
service fees `−` book.

---

## 4. Inputs & data model

### 4.1 Inputs (left panel)

| Field | id | Rule |
|---|---|---|
| Bank statement balance | `br-bank-balance` | required, ≥ 0 |
| Book cash balance | `br-book-balance` | required, ≥ 0 |
| Deposits in transit | `br-deposits` | optional (blank = 0), ≥ 0 |
| Outstanding checks | `br-checks` | optional, ≥ 0 |
| Bank service fees | `br-fees` | optional, ≥ 0 |
| Interest earned | `br-interest` | optional, ≥ 0 |
| Error amount | `br-error-amount` | optional, ≥ 0 |
| Error side | `br-error-side` | select: `bank` / `book` |
| Error direction | `br-error-direction` | select: `increase` / `decrease` |

All money fields reuse the existing `money-input` + digit sanitizer.

### 4.2 Pure functions (no DOM; unit-testable in Node)

- `reconcile(inputs)` →
  ```
  {
    bank: { lines: [ {label, amount, sign} ... ], adjusted },
    book: { lines: [ {label, amount, sign} ... ], adjusted },
    reconciled: boolean,
    difference: adjustedBank - adjustedBook
  }
  ```
  `lines` include the starting balance and only the non-zero adjustments (plus the error on its chosen side).
- `suggestedEntries(inputs)` → array of `{ item, needsEntry, debit?, credit?, amount, note }`.

### 4.3 Book-side → suggested journal entry mapping (fixed)

| Item | Needs entry? | Debit | Credit |
|---|---|---|---|
| Bank service fees | yes | Bank Service Charge Expense | Cash |
| Interest earned | yes | Cash | Interest Revenue |
| Book error (+, increases book cash) | yes | Cash | *Misstated account* |
| Book error (−, decreases book cash) | yes | *Misstated account* | Cash |
| Deposits in transit | no | — | — |
| Outstanding checks | no | — | — |
| Bank error | no | — | — |

Bank-side items carry a short reason ("timing difference — it will clear on its own" / "the bank's
correction — contact the bank; no entry on your books").

---

## 5. UI layout & output

Two-panel layout (reuses `sim-layout`, `sim-panel`, `field`/`money-input`, `sim-empty`/`sim-dashboard`,
`preview-card`/`preview-table`, `health-banner`, `explanation-list`, `suggestion-list`, `.btn`).

**Left panel (`#br-form`):** the inputs above + "Reconcile" (primary) and "Reset" (secondary) buttons.

**Right panel (`#br-results`):** empty state → on Reconcile, top to bottom:

1. **Status banner** (`health-banner`): green "Reconciled — both adjusted balances equal $X." or red
   "Not reconciled — difference of $X. Recheck the side that's off."
2. **Reconciliation report** (`preview-card`): two small stacked statements (Bank side, Book side), each
   showing the starting balance, the non-zero adjustment lines (signed), and the bold **Adjusted balance**.
3. **What each adjustment means** (`explanation-list`): one beginner sentence per non-zero adjustment used.
4. **Journal entries you'd record** (`suggestion-list`): a DR/CR line for each book-side item that needs one;
   bank-side items shown as "no entry needed" with the reason.

Stacks to one column on mobile. Minimal new CSS (a couple of layout/spacing tweaks; reuses existing styles).

---

## 6. Edge cases & validation

- **Balances:** required; blank / invalid / negative → inline error (reuses red-border message UI).
- **Adjustments + error amount:** optional; blank counts as 0; if entered, must be a valid number ≥ 0.
- **Error side/direction:** default `bank` / `increase`; only affect output when error amount > 0.
- **Reconcile check:** equality within `< 0.005`.
- **Reset / refresh / bfcache:** clears inputs, resets selects, returns to empty state — folded into the
  existing on-load reset pattern.
- **Formatting:** amounts via existing `formatMoney`; subtracted lines shown in parentheses or with a `−`.

---

## 7. Testing approach

Dependency-free; no external libraries.

1. **`bank-reconciliation.js`** holds the pure `reconcile()` + `suggestedEntries()` with a dual-export guard
   (`if (typeof module !== "undefined") module.exports = {...}`) so the same file runs in the browser and Node.
2. **`tests/bank-reconciliation.test.js`** (run `node tests/bank-reconciliation.test.js`, built-in `assert`):
   - Reconciled example → `reconciled: true` with correct adjusted balances.
   - Non-reconciled example → correct `difference`.
   - Error applied only to the chosen side and in the chosen direction.
   - `suggestedEntries`: fees → DR Bank Service Charge Expense / CR Cash; interest → DR Cash / CR Interest
     Revenue; book error correcting-entry direction; bank-side items `needsEntry: false`.
   - Blank adjustments treated as 0.
3. **Manual browser checklist:** report rendering (signed lines, adjusted totals), status banner colors,
   validation messages, reset, refresh/bfcache clearing, two-panel→stacked responsiveness, dark-mode styling.

---

## 8. Files expected to change

- **New:** `bank-reconciliation.js` (data + pure logic), `tests/bank-reconciliation.test.js`, this spec doc.
- **Edit:** `index.html` (`#tools` section only — add the second tool below the Journal Entry Helper; add
  `<script src="bank-reconciliation.js">`), `script.js` (init + render + validation + reset, wired into the
  existing load/reset), `styles.css` (minor additions).

No homepage sections outside `#tools` change. No new features beyond Bank Reconciliation Helper v1.
