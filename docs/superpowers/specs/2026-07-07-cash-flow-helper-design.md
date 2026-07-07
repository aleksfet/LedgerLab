# Cash Flow Helper — v1 Design Spec

**Date:** 2026-07-07
**Status:** Approved (brainstorming complete)
**Scope:** Fifth Accounting Tool in LedgerLab. Simplified, beginner-friendly Statement of Cash
Flows (direct-method classification + summary). Not a full advanced Statement of Cash Flows.

---

## 1. Goal

Help beginners understand how actual cash moves through a business and why **profit is not always
the same as cash flow**. The user picks real cash transactions from a fixed menu; LedgerLab
automatically classifies each into **Operating**, **Investing**, or **Financing** activities,
totals each section, computes the **net change in cash**, and reconciles **beginning cash** to
**ending cash**. The result reads like a simplified Statement of Cash Flows — teaching how
accountants organize cash transactions — not just a calculator.

Mirrors the Journal Entry Helper, Bank Reconciliation Helper, Depreciation Calculator, and Income
Statement Builder: a data-driven module with a pure function, a two-panel UI inside the Accounting
Tools section, and Node tests.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Method | Simplified **direct method**: real cash transactions grouped into the three activity sections |
| Classification | **Automatic** (guided auto-classify). The user never chooses the category; each preset carries its category and cash direction |
| Transaction set | **Fixed catalog of 9 preset transactions** (section 3). No free-text/custom transactions in v1 |
| Beginning cash | Optional **Beginning cash balance** input (money ≥ 0; blank = 0) so ending cash is meaningful |
| Results format | **Approach A** — simplified Statement of Cash Flows: three grouped sections, per-section subtotals, net change, beginning→ending reconciliation, plus scannable summary cards on top |
| Net change feedback | Net-change summary card flips **green (positive) / red (negative)**, matching the Income Statement net card |
| Profit ≠ cash | **3 always-on worked examples** + **tailored callouts** based on the user's actual statement (section 6.3) |
| Light insight | One compact business-insight callout interpreting operating vs. financing cash flow (section 6.4) |
| Placement | Fifth tool inside the existing `#tools` "Accounting Tools" section |
| Layout | Two-panel (inputs left, output right); stacks on mobile. Reuses existing components |
| Structure | Data-driven: `cash-flow.js` with pure `buildCashFlow()`; dual-export for browser + Node |
| Prefix | `cf-` for all ids/classes |

**Out of scope for v1:** free-text/custom transactions, user-chosen classification, interest paid/
received, income taxes, dividends paid (deliberately excluded — their classification differs
between US GAAP and IFRS and would confuse beginners), indirect method, non-cash disclosures,
multi-period comparison, saving/exporting/printing.

---

## 3. Preset transaction catalog

The only transactions available in v1. Each preset has a fixed **category** and cash **direction**;
the user picks the transaction and enters an amount, and the sign is applied automatically.

| id | Label | Category | Direction |
|---|---|---|---|
| `cust` | Cash received from customers | Operating | inflow (+) |
| `rent` | Paid rent | Operating | outflow (−) |
| `wages` | Paid wages | Operating | outflow (−) |
| `buy-equip` | Bought equipment | Investing | outflow (−) |
| `sell-equip` | Sold equipment | Investing | inflow (+) |
| `owner-invest` | Owner invested cash | Financing | inflow (+) |
| `loan-proceeds` | Loan proceeds | Financing | inflow (+) |
| `loan-principal` | Paid loan principal | Financing | outflow (−) |
| `owner-withdraw` | Owner withdrew cash | Financing | outflow (−) |

Category order for display: **Operating → Investing → Financing**.

---

## 4. Inputs & data model

### 4.1 Inputs (left panel)

| Field | id | Rule |
|---|---|---|
| Business name | `cf-name` | optional (text); header display only |
| Period | `cf-period` | optional (text, e.g. "June 2026"); header display only |
| Beginning cash balance | `cf-beginning` | money ≥ 0; blank counts as 0 |
| Transaction rows | `cf-transactions` container | 0+ rows; each = transaction dropdown + amount |

**Transaction row:** a `<select>` populated from the catalog (options grouped under `<optgroup>`
Operating / Investing / Financing so the category is visible while choosing) plus a money amount
input (≥ 0; blank/invalid → 0) and a remove (✕) button. "**+ Add transaction**" appends a row.
Dynamically added amount inputs get the same money sanitizer used by the other tools.

**Example scenarios:** 2–3 compact preset example buttons (like the Depreciation / Income Statement
tools) that fill a set of rows + a beginning balance and auto-build the statement. Scenarios are
chosen to exercise all three categories and at least one negative-operating case.

### 4.2 Validation

- Beginning cash: if non-blank, must be a finite number ≥ 0, else inline error.
- Transaction rows: a row with an amount but no transaction selected (or vice versa) is an inline
  error ("Pick a transaction and enter an amount, or remove the row."). Fully blank rows are
  ignored.
- Build with zero valid transactions keeps the empty state and nudges the first row (consistent
  with the Income Statement Builder's empty-submit behavior).

---

## 5. Pure function — `cash-flow.js`

`buildCashFlow(inputs)` — no DOM; unit-testable in Node; also attaches to
`window.CashFlow` for the browser (dual-export, no libraries). Same `round2` / `money` helpers as
the sibling modules (blank/NaN/negative → 0; round to cents).

**Input:** `{ name, period, beginningCash, transactions: [{ type, amount }] }`
where `type` is a catalog id and `amount` is a non-negative magnitude.

**Logic:**
1. For each transaction, look up the catalog entry by `type`; skip unknown/invalid types and rows
   with `amount ≤ 0`. Signed amount = `+amount` for inflow, `−amount` for outflow.
2. Group signed line items into the three category buckets, preserving entry order within a bucket.
3. Subtotals: `operatingCash`, `investingCash`, `financingCash` (each rounded to cents).
4. `netChange = operatingCash + investingCash + financingCash`.
5. `endingCash = round2(beginningCash + netChange)`.
6. Return `null` when there are no valid transactions (empty state stays), mirroring
   `buildIncomeStatement`.

**Returned view-model (shape):**

```
{
  name, period,
  beginningCash, endingCash,
  operating:  { lines: [{ label, amount }], subtotal },   // amount is signed
  investing:  { lines: [...], subtotal },
  financing:  { lines: [...], subtotal },
  netChange,
  isNetPositive,            // netChange >= 0 (drives green/red)
  flags: {                  // drive tailored callouts (section 6.3 / 6.4)
    hasEquipmentPurchase,   // any buy-equip present
    hasOwnerInvestment,     // any owner-invest present
    reliedOnFinancing       // operatingCash < 0 && financingCash > 0
  }
}
```

The three always-on worked examples (section 6.3) are static copy in the UI layer and do **not**
depend on `flags`; `flags` only gate the tailored callouts.

---

## 6. Results (right panel) — Approach A

### 6.1 Summary cards (scannable top row)

- Operating cash flow · Investing cash flow · Financing cash flow · **Net change in cash**.
- Net change card flips green when `isNetPositive`, red otherwise (reuse `.is-positive` /
  `.is-negative` / `.stat-value.is-loss`-style treatment already in the codebase).
- Ending cash is shown in the reconciliation line (6.2), not as a separate card.

### 6.2 Simplified Statement of Cash Flows (table)

Reuses the `preview-card` / `preview-table` styling from the Income Statement statement.

- **Cash flows from Operating activities** — line items (signed) → **subtotal**.
- **Cash flows from Investing activities** — line items (signed) → **subtotal**.
- **Cash flows from Financing activities** — line items (signed) → **subtotal**.
- **Net change in cash** (bold; green/red).
- Reconciliation block: **Beginning cash balance** + **Net change in cash** = **Ending cash
  balance**.
- Sections with no transactions render an unobtrusive "None this period" line so the three-bucket
  structure is always visible (teaching the framework even when a category is empty).

### 6.3 "Why profit ≠ cash" — 3 always-on examples + tailored callouts

Compact, beginner-friendly. **Always shown** (independent of the user's data):

1. **Sale on account** — Revenue and profit can increase before cash is actually collected.
2. **Buy equipment for cash** — Cash decreases now, but the full equipment purchase is not
   immediately treated as an expense on the income statement (only depreciation is, over time).
3. **Owner invests cash** — Cash increases, but the owner investment is financing, not revenue or
   profit.

**Tailored callouts** (shown only when the corresponding flag is true, appended below the three
examples, phrased against the user's own statement):

- `hasEquipmentPurchase` → "In your statement, equipment purchases reduced cash through Investing
  Activities."
- `hasOwnerInvestment` → "In your statement, owner investment increased cash through Financing
  Activities, not Operating Activities."

### 6.4 Light business insight

One compact callout (mirrors the Income Statement "manager's review" style). Primary case:

- `reliedOnFinancing` → "This period, the business relied on owner or loan financing because
  operating cash flow was negative."

When `reliedOnFinancing` is false, a short neutral interpretation of operating cash flow is shown
instead (e.g. positive operating cash flow means day-to-day operations generated cash this period).
This insight is distinct from — and not duplicated by — the 6.3 tailored callouts.

---

## 7. Files & wiring

| File | Change |
|---|---|
| `cash-flow.js` | New. Pure `buildCashFlow()` + catalog + `round2`/`money`; dual-export (`window.CashFlow` / `module.exports`) |
| `tests/cash-flow.test.js` | New. Node tests (section 8) |
| `index.html` | New fifth tool block in `#tools`; `<script src="cash-flow.js">` before `script.js` |
| `styles.css` | Reuse existing `sim-*`, `preview-*`, `stat-*`, `explanation-*`, `is-*` patterns; add minimal `cf-` rules only where needed (e.g. transaction row, grouped select) |
| `script.js` | `initCashFlow()` (build/render/reset, add-row, example buttons) wired into `DOMContentLoaded`; `resetCashFlow()` on load |

Follows the established per-tool conventions (prefix, two-panel layout, empty→dashboard toggle,
`aria-live` results, money sanitizer, inline error helpers).

---

## 8. Testing

Node tests for `buildCashFlow`:

- Each preset classifies into the correct category with the correct sign.
- Operating / Investing / Financing subtotals sum their signed line items correctly.
- `netChange` = sum of the three subtotals; `endingCash` = beginningCash + netChange.
- Beginning cash 0 / blank handled; negative & NaN amounts coerced to 0.
- Unknown transaction types and amount ≤ 0 rows are skipped.
- Returns `null` when there are no valid transactions.
- `flags` computed correctly: `hasEquipmentPurchase`, `hasOwnerInvestment`, and `reliedOnFinancing`
  (true only when operating < 0 and financing > 0; false otherwise, including all-positive and
  operating<0/financing≤0 cases).
- Rounding to cents on subtotals, net change, and ending cash.

---

## 9. Non-goals recap

Not building a full advanced Statement of Cash Flows. No indirect method, no non-cash schedules,
no interest/tax/dividend lines, no custom transactions, no multi-period comparison, no export. v1
stays simple, fixed-catalog, and educational.
