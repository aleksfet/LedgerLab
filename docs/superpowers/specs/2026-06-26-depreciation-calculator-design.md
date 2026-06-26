# Depreciation Calculator — v1 Design Spec

**Date:** 2026-06-26
**Status:** Approved (brainstorming complete)
**Scope:** Third Accounting Tool in LedgerLab. Straight-line depreciation only.

---

## 1. Goal

Help beginners understand how long-term assets lose value over time and how depreciation
affects accounting. The user enters an asset's cost, salvage value, and useful life; the tool
shows the annual and monthly depreciation, a year-by-year schedule of book value, the journal
entry, and a plain-English explanation.

Mirrors the Journal Entry Helper and Bank Reconciliation Helper: a data-driven module with a
pure function, a two-panel UI inside the Accounting Tools section, and Node tests.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Method | Straight-line only for v1 |
| Final-year rounding | Years 1…n−1 use the rounded annual amount; the final year is trued up so book value ends **exactly** at salvage |
| Validation | Strict & beginner-safe (see §6) |
| Placement | Third tool inside the existing `#tools` "Accounting Tools" section |
| Layout | Two-panel (inputs left, output right); stacks on mobile. Reuses existing components |
| Structure | Data-driven: `depreciation.js` with pure `calculateDepreciation()`; dual-export for browser + Node |

**Out of scope for v1:** other methods (declining balance, units of production, sum-of-years),
partial-year / mid-year conventions, fractional useful life, tax depreciation (MACRS), disposal.

---

## 3. Formulas (straight-line)

```
depreciableBase = cost - salvage
standardAnnual  = round2(depreciableBase / usefulLife)
monthly         = round2(standardAnnual / 12)

For year i in 1..usefulLife:
  expense_i   = (i < usefulLife) ? standardAnnual
                                 : depreciableBase - standardAnnual * (usefulLife - 1)   // true-up
  accumulated_i = sum(expense_1..expense_i)
  bookValue_i   = cost - accumulated_i
```

Guarantees: `accumulated_(usefulLife) === depreciableBase` and `bookValue_(usefulLife) === salvage`
exactly. `round2(x) = Math.round(x * 100) / 100`.

Edge case `usefulLife = 1`: the single year's expense is the full base; book value ends at salvage.

---

## 4. Inputs & data model

### 4.1 Inputs (left panel)

| Field | id | Rule |
|---|---|---|
| Asset name | `dep-name` | required (text) |
| Asset cost | `dep-cost` | required, money > 0 |
| Salvage value | `dep-salvage` | required, money ≥ 0 and < cost |
| Useful life (years) | `dep-life` | required, whole number 1–50 |
| Method | `dep-method` | select; only option **Straight-Line** (v1) |

Money fields reuse the existing `money-input` + digit sanitizer. Useful life is a plain integer
number input.

### 4.2 Pure function (no DOM; Node-testable)

```
calculateDepreciation(inputs) -> {
  name, cost, salvage, usefulLife, method: "Straight-Line",
  depreciableBase, annual, monthly,
  schedule: [ { year, expense, accumulated, bookValue } ],   // length === usefulLife
  journal: { debit: "Depreciation Expense", credit: "Accumulated Depreciation", amount: annual }
}
```

`annual` is the standard annual amount (the recurring journal-entry figure). The final schedule
row may differ by the rounding true-up.

---

## 5. UI layout & output

Two-panel layout (reuses `sim-layout`, `sim-panel`, `field`/`money-input`, `sim-empty`/`sim-dashboard`,
`stat-grid`/`stat-card`, `preview-card`/`preview-table`, `explanation`/`explanation-list`, `.btn`).

**Left panel (`#dep-form`):** the inputs above + "Calculate" (primary) and "Reset" (secondary).

**Right panel (`#dep-results`):** empty state → on Calculate, top to bottom:

1. **Summary stat cards** (`stat-grid`): Annual depreciation, Monthly depreciation, Depreciable base.
2. **Journal entry card** (`preview-card`): DR **Depreciation Expense** / CR **Accumulated Depreciation**
   for the annual amount, with a totals/balance line and a note: "recorded each year (the final year
   uses the remaining balance)."
3. **Depreciation schedule** (`preview-table`): columns **Year | Depreciation | Accumulated | Book value**,
   one row per year. A scroll cap keeps long schedules compact.
4. **What depreciation means** (`explanation-list`): straight-line spreads cost minus salvage evenly over
   the useful life; Accumulated Depreciation is a contra-asset that lowers the asset's book value; monthly
   is the annual amount divided by 12.

Stacks to one column on mobile. Minimal new CSS (schedule scroll wrapper; otherwise reuses existing styles).

---

## 6. Edge cases & validation

- **Asset name:** required; blank → error.
- **Asset cost:** required; blank/invalid/≤ 0 → error.
- **Salvage value:** required; blank/invalid/< 0 → error; **≥ cost → "Salvage must be less than the asset cost."**
- **Useful life:** required; must be a whole number in 1–50 → error otherwise (e.g., "Enter a whole number of years (1–50).").
- **Reset / refresh / bfcache:** clears inputs, returns to empty state — folded into the existing on-load reset pattern.
- **Formatting:** amounts via existing `formatMoney`.

---

## 7. Testing approach

Dependency-free; no external libraries.

1. **`depreciation.js`** holds the pure `calculateDepreciation()` with a dual-export guard
   (`if (typeof module !== "undefined") module.exports = {...}`) so the same file runs in the browser and Node.
2. **`tests/depreciation.test.js`** (run `node tests/depreciation.test.js`, built-in `assert`):
   - Annual = (cost − salvage) / life; monthly = annual / 12 (clean example).
   - Schedule length === useful life.
   - **Final book value === salvage exactly**, and final accumulated === depreciable base (true-up).
   - Rounding case: cost 10,000 / salvage 0 / life 3 → final-year book value exactly 0.
   - `usefulLife = 1`: single full-base year ending at salvage.
   - Journal entry = DR Depreciation Expense / CR Accumulated Depreciation, amount = annual.
3. **Manual browser checklist:** stat cards, journal card, schedule rendering + scroll, validation messages
   (including salvage < cost), reset, refresh/bfcache clearing, two-panel→stacked responsiveness, dark-mode styling.

---

## 8. Files expected to change

- **New:** `depreciation.js` (data + pure logic), `tests/depreciation.test.js`, this spec doc.
- **Edit:** `index.html` (`#tools` section only — add the third tool; add `<script src="depreciation.js">`),
  `script.js` (init + render + validation + reset, wired into the existing load/reset), `styles.css` (minor).

No homepage sections outside `#tools` change. No new features beyond Depreciation Calculator v1.
