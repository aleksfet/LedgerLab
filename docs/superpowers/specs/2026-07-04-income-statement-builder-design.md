# Income Statement Builder — v1 Design Spec

**Date:** 2026-07-04
**Status:** Approved (brainstorming complete)
**Scope:** Fourth Accounting Tool in LedgerLab. Single-step income statement only.

---

## 1. Goal

Help beginners understand how revenue and expenses become **net income** or **net loss**. The
user enters revenue and a set of common operating expenses; the tool produces a clean single-step
income statement, the key totals and profit margin, a plain-English explanation of what the result
means, and action-oriented managerial advice about the largest expense.

Mirrors the Journal Entry Helper, Bank Reconciliation Helper, and Depreciation Calculator: a
data-driven module with a pure function, a two-panel UI inside the Accounting Tools section, and
Node tests.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Format | **Single-step** only for v1: Total Revenue − Total Expenses = Net Income (or Net Loss) |
| Inputs | Fixed labeled fields for common categories **plus** optional simple add-your-own rows on both the revenue and expense sides |
| Managerial advice | Net-profit-**margin bands** (framed as general planning signals, not industry benchmarks) + an action-oriented callout on the single largest expense, adapted to that expense category |
| Placement | Fourth tool inside the existing `#tools` "Accounting Tools" section |
| Layout | Two-panel (inputs left, output right); stacks on mobile. Reuses existing components |
| Structure | Data-driven: `income-statement.js` with pure `buildIncomeStatement()`; dual-export for browser + Node |

**Out of scope for v1:** multi-step format, cost of goods sold / gross profit, operating vs.
non-operating separation, taxes and interest lines, prior-period comparison, industry benchmark
data, saving/exporting/printing, multiple periods.

---

## 3. Inputs & data model

### 3.1 Inputs (left panel)

| Field | id | Rule |
|---|---|---|
| Business name | `is-name` | optional (text); header display only |
| Period | `is-period` | optional (text, e.g. "June 2026"); header display only |
| Sales / service revenue | `is-revenue` | money ≥ 0; blank counts as 0 |
| Rent expense | `is-rent` | money ≥ 0; blank counts as 0 |
| Wages expense | `is-wages` | money ≥ 0; blank counts as 0 |
| Supplies expense | `is-supplies` | money ≥ 0; blank counts as 0 |
| Utilities expense | `is-utilities` | money ≥ 0; blank counts as 0 |
| Depreciation expense | `is-depreciation` | money ≥ 0; blank counts as 0 |
| Other expense | `is-other` | money ≥ 0; blank counts as 0 |
| Custom revenue rows | `+ Add revenue` | 0..n rows of `{ label, amount }` |
| Custom expense rows | `+ Add expense` | 0..n rows of `{ label, amount }` |

Money fields reuse the existing `money-input` + digit sanitizer. Custom rows are lightweight:
a text label and a money input, with a small "✕" to remove the row. **At least one revenue or
expense amount must be > 0** to compute; an all-zero form stays in the empty state.

The six fixed expense fields always render as statement lines (showing 0 if left blank), so
beginners see the standard categories. Custom rows appear only when the user adds them and only
render as lines when they carry an amount.

### 3.2 Pure function (no DOM; Node-testable)

```
buildIncomeStatement(inputs) -> {
  name, period,
  revenueLines:  [ { label, amount } ],   // fixed sales/service line + custom revenue rows with amount > 0
  expenseLines:  [ { label, amount, key } ],  // six fixed lines (always) + custom expense rows with amount > 0
  totalRevenue,
  totalExpenses,
  netIncome,                 // totalRevenue - totalExpenses; may be negative (net loss)
  isLoss,                    // netIncome < 0
  margin,                    // netIncome / totalRevenue, or null when totalRevenue === 0
  marginBand,                // "loss" | "thin" | "healthy" | "strong" | null (null when margin null)
  centsKept,                 // round(margin * 100) for the "keep X cents" line, or null
  largestExpense,            // { label, amount, key, pctOfRevenue|null } or null when no expenses
  hasDepreciation            // depreciation amount > 0
}
```

Returns `null` when there is nothing to compute (no revenue and no expenses). `key` on expense
lines is the category identifier (`rent`, `wages`, `supplies`, `utilities`, `depreciation`,
`other`, or `custom`) used to select category-specific advice.

---

## 4. Calculations

```
totalRevenue  = sales/service + sum(custom revenue amounts)
totalExpenses = rent + wages + supplies + utilities + depreciation + other + sum(custom expense amounts)
netIncome     = totalRevenue - totalExpenses          // negative => net loss
margin        = (totalRevenue > 0) ? netIncome / totalRevenue : null
centsKept     = (margin != null) ? Math.round(margin * 100) : null
```

**Margin bands** (from `margin`, only when `totalRevenue > 0`):

| Band | Condition |
|---|---|
| `loss` | margin < 0% |
| `thin` | 0% ≤ margin < 10% |
| `healthy` | 10% ≤ margin < 20% |
| `strong` | margin ≥ 20% |

**Largest expense:** the single line with the greatest amount among all expense lines (fixed +
custom) with amount > 0; `pctOfRevenue = amount / totalRevenue` when revenue > 0, else `null`.
Ties resolve to the first in fixed order, then custom order.

All money rounded with the existing `round2`/`formatMoney` convention.

---

## 5. UI layout & output

Two-panel layout (reuses `sim-layout`, `sim-panel`, `field`/`money-input`, `sim-empty`/`sim-dashboard`,
`stat-grid`/`stat-card`, `preview-card`/`preview-table`, `explanation`/`explanation-list`, `.btn`).

**Left panel (`#is-form`):** the inputs above, the two "+ Add" controls, plus "Build statement"
(primary) and "Reset" (secondary).

**Right panel (`#is-results`):** empty state → on Build, top to bottom:

1. **Summary stat cards** (`stat-grid`): Total Revenue · Total Expenses · **Net Income / Net Loss** ·
   Profit Margin. The net card is labeled "Net Income" or "Net Loss" and uses the loss color when
   negative; the margin card shows "—" when revenue is 0.
2. **Income statement** (`preview-card` + `preview-table`): optional header line with business name
   and period; a **Revenue** section listing each revenue line → **Total revenue**; an **Expenses**
   section listing each expense line (six fixed + any custom) → **Total expenses**; a ruled
   **Net income** / **Net loss** line. A net loss is parenthesized and shown in the loss color.
3. **What this means** (`explanation-list`):
   - The "keep X cents" sentence: *"You keep {centsKept}¢ of every $1 of revenue."* (shown only when
     margin is available). For a loss, the wording reflects that the business spent more than it
     earned.
   - The margin band with an explicit framing line: **"These margin categories are general planning
     signals, not industry benchmarks. Healthy margins vary by industry and business model."**
   - When `totalRevenue === 0`: a note that profit margin needs revenue to be meaningful.
4. **Manager's review** (action-oriented callout on `largestExpense`): names the largest expense and
   its % of revenue, then what a manager would actually review, adapted to the category (see §6).
5. **Depreciation note** (shown only when `hasDepreciation`): *"Depreciation lowers profit but isn't
   a cash payment this period — your cash didn't drop by this amount. It spreads the cost of a
   long-term asset over its useful life."*

Stacks to one column on mobile. Minimal new CSS (custom-row layout; otherwise reuses existing styles).

---

## 6. Managerial advice (category-adaptive)

The callout always leads with the fact, then the review guidance for the largest expense's category.
Framing avoids presenting bands as universal standards.

Lead (all categories): *"{Label} is the largest expense at {pct}% of revenue."* (omit the "% of
revenue" clause when revenue is 0).

Category-specific review guidance:

| key | Guidance |
|---|---|
| `rent` | A manager would review the location's cost, the lease terms, and whether the space is being fully used. |
| `wages` | A manager would review staffing levels, scheduling, productivity, and whether current revenue is high enough to support payroll. |
| `supplies` | A manager would review purchasing, waste, vendor pricing, and how supplies are being used. |
| `utilities` | A manager would review energy efficiency and investigate any unusual increases. |
| `depreciation` | This is a non-cash expense tied to using long-term assets over time, not money leaving the business this period. |
| `other` | A manager would review the underlying items, since "Other" can hide significant costs that belong in their own category. |
| `custom` | A manager would review the underlying items behind this line to understand what's driving the cost. |

---

## 7. Edge cases & validation

- **Money fields:** blank counts as 0; negative/invalid → error via the existing money sanitizer.
- **Nothing to compute:** no revenue and no expenses > 0 → stay in empty state (no statement).
- **Zero revenue, some expenses:** compute a net loss; margin card and margin sentences show "—" /
  the revenue-needed note; the manager callout omits the "% of revenue" clause.
- **Net loss:** `netIncome < 0`; net line labeled "Net Loss", parenthesized, loss color; band = `loss`.
- **Custom rows:** a row with a label but no amount, or an amount but no label → validation error
  ("Add both a name and an amount, or remove the row."). Rows fully blank are ignored.
- **Business name / period:** optional; when blank the statement header simply omits them.
- **Reset / refresh / bfcache:** clears inputs and custom rows, returns to empty state — folded into
  the existing on-load reset pattern.
- **Formatting:** amounts via existing `formatMoney`.

---

## 8. Testing approach

Dependency-free; no external libraries.

1. **`income-statement.js`** holds the pure `buildIncomeStatement()` with a dual-export guard
   (`if (typeof module !== "undefined") module.exports = {...}`) so the same file runs in the browser and Node.
2. **`tests/income-statement.test.js`** (run `node tests/income-statement.test.js`, built-in `assert`):
   - Totals: revenue and expense sums, including custom rows.
   - Net income positive case; net **loss** case (expenses > revenue).
   - Margin value and band selection at each boundary (loss / thin / healthy / strong), incl. exactly 10% and 20%.
   - `centsKept` rounding (e.g. margin 0.24 → 24).
   - Zero-revenue case: `margin === null`, `marginBand === null`, still computes a loss.
   - Largest-expense pick, including a custom row being the largest, and tie resolution.
   - `hasDepreciation` true only when depreciation > 0.
   - `null` return when there is nothing to compute.
3. **Manual browser checklist:** stat cards (incl. Net Loss labeling/color and margin "—"), statement
   rendering with custom rows, margin explanation with the general-planning-signal framing, the
   category-adaptive manager callout for each category, depreciation note visibility, custom-row
   add/remove + validation, reset, refresh/bfcache clearing, two-panel→stacked responsiveness,
   dark-mode styling.

---

## 9. Files expected to change

- **New:** `income-statement.js` (data + pure logic), `tests/income-statement.test.js`, this spec doc.
- **Edit:** `index.html` (`#tools` section only — add the fourth tool; add `<script src="income-statement.js">`),
  `script.js` (init + render + validation + reset + dynamic custom rows, wired into the existing load/reset),
  `styles.css` (minor — custom-row layout).

No homepage sections outside `#tools` change. No new features beyond Income Statement Builder v1.
