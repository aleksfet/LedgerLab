# Income Statement Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fourth LedgerLab Accounting Tool — a single-step Income Statement Builder that turns revenue and expenses into net income/loss with margin-band guidance and category-adaptive managerial advice.

**Architecture:** A pure, DOM-free logic module (`income-statement.js`) with `buildIncomeStatement(inputs)`, dual-exported for Node tests and the browser (`window.IncomeStatement`). A two-panel tool UI added inside the existing `#tools` section of `index.html`, wired up in `script.js` following the exact pattern of the Depreciation Calculator (init/validate/render/reset + DOMContentLoaded + pageshow), with minor CSS for the custom-row layout.

**Tech Stack:** Vanilla ES5-style JS (IIFE, `var`), plain HTML/CSS, Node built-in `assert` for tests. No external libraries.

## Global Constraints

- No external libraries or build step; dependency-free (ES5 idioms, `var`, IIFE) — matches existing modules.
- Dual-export guard: `if (typeof module !== "undefined" && module.exports)` for Node; else attach to `root`.
- Reuse existing helpers/classes: `formatMoney`, `showError`/`clearError`/`getFieldWrapper`, `.money-input`, `sim-layout`/`sim-panel`/`sim-form`, `sim-empty`/`sim-dashboard`, `stat-grid`/`stat-card`, `report-section`/`report-heading`, `preview-card`/`preview-table`, `explanation`/`explanation-list`, `.btn`.
- All money via `formatMoney`; money rounding via `round2` (`Math.round(x*100)/100`).
- Changes limited to the `#tools` section of `index.html`; no other homepage sections change.
- Margin bands are framed as general planning signals, NOT industry benchmarks (exact framing copy required — see Task 1/Task 4).
- Do not add features beyond v1 (no multi-step, no COGS, no export/print, no taxes/interest).

---

### Task 1: Pure logic module `income-statement.js` (TDD)

**Files:**
- Create: `income-statement.js`
- Test: `tests/income-statement.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `window.IncomeStatement` / `module.exports` = `{ round2, EXPENSE_KEYS, ADVICE, buildIncomeStatement }`.

```
buildIncomeStatement(inputs) -> null | {
  name, period,
  revenueLines: [ { label, amount } ],          // sales/service (if >0) + custom revenue rows (amount>0)
  expenseLines: [ { label, amount, key } ],     // six fixed lines ALWAYS (even if 0) + custom expense rows (amount>0), key="custom"
  totalRevenue, totalExpenses,
  netIncome, isLoss,
  margin,        // netIncome/totalRevenue, or null when totalRevenue===0
  marginBand,    // "loss"|"thin"|"healthy"|"strong"|null
  centsKept,     // Math.round(margin*100) or null
  largestExpense, // { label, amount, key, pctOfRevenue|null } or null when no expense >0
  hasDepreciation // depreciation>0
}
```

`inputs` shape:
```
{
  name, period,
  revenue,                                  // sales/service, number (blank -> 0)
  rent, wages, supplies, utilities, depreciation, other,  // numbers (blank -> 0)
  customRevenue: [ { label, amount } ],     // optional
  customExpenses: [ { label, amount } ]     // optional
}
```

- [ ] **Step 1: Write the failing tests** — create `tests/income-statement.test.js`:

```javascript
/* ============================================================
   Tests for income-statement.js
   Run with: node tests/income-statement.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */

"use strict";

var assert = require("assert");
var IS = require("../income-statement.js");
var build = IS.buildIncomeStatement;

var passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok - " + name);
}

console.log("income-statement.js");

test("totals include fixed fields and custom rows", function () {
  var r = build({
    revenue: 15000,
    rent: 3000, wages: 6000, supplies: 800, utilities: 700,
    depreciation: 500, other: 400,
    customRevenue: [{ label: "Interest income", amount: 100 }],
    customExpenses: [{ label: "Marketing", amount: 200 }],
  });
  assert.strictEqual(r.totalRevenue, 15100);
  assert.strictEqual(r.totalExpenses, 11600);
  assert.strictEqual(r.netIncome, 3500);
  assert.strictEqual(r.isLoss, false);
});

test("six fixed expense lines always present, in order, even when zero", function () {
  var r = build({ revenue: 1000 });
  var keys = r.expenseLines.map(function (l) { return l.key; });
  assert.deepStrictEqual(keys, ["rent", "wages", "supplies", "utilities", "depreciation", "other"]);
  assert.strictEqual(r.expenseLines[0].amount, 0);
});

test("custom expense rows with amount>0 append after fixed lines; blanks ignored", function () {
  var r = build({
    revenue: 1000,
    customExpenses: [
      { label: "Marketing", amount: 200 },
      { label: "", amount: 0 },
    ],
  });
  assert.strictEqual(r.expenseLines.length, 7);
  assert.strictEqual(r.expenseLines[6].key, "custom");
  assert.strictEqual(r.expenseLines[6].label, "Marketing");
});

test("net loss when expenses exceed revenue", function () {
  var r = build({ revenue: 1000, rent: 1500 });
  assert.strictEqual(r.netIncome, -500);
  assert.strictEqual(r.isLoss, true);
  assert.strictEqual(r.marginBand, "loss");
});

test("margin bands at boundaries", function () {
  assert.strictEqual(build({ revenue: 100, rent: 101 }).marginBand, "loss");   // -1%
  assert.strictEqual(build({ revenue: 100, rent: 95 }).marginBand, "thin");    // 5%
  assert.strictEqual(build({ revenue: 100, rent: 90 }).marginBand, "thin");    // exactly 10%? no -> 10% is healthy
  assert.strictEqual(build({ revenue: 100, rent: 90 }).marginBand, "healthy"); // 10% -> healthy
  assert.strictEqual(build({ revenue: 100, rent: 85 }).marginBand, "healthy"); // 15%
  assert.strictEqual(build({ revenue: 100, rent: 80 }).marginBand, "strong");  // exactly 20% -> strong
  assert.strictEqual(build({ revenue: 100, rent: 50 }).marginBand, "strong");  // 50%
});

test("centsKept rounds margin to whole cents", function () {
  var r = build({ revenue: 15000, rent: 11400 });  // margin 0.24
  assert.strictEqual(r.centsKept, 24);
});

test("zero revenue: margin/band/centsKept null, still computes loss", function () {
  var r = build({ rent: 500 });
  assert.strictEqual(r.totalRevenue, 0);
  assert.strictEqual(r.margin, null);
  assert.strictEqual(r.marginBand, null);
  assert.strictEqual(r.centsKept, null);
  assert.strictEqual(r.netIncome, -500);
  assert.strictEqual(r.isLoss, true);
});

test("largest expense picks the biggest line and its % of revenue", function () {
  var r = build({ revenue: 10000, rent: 2000, wages: 3800 });
  assert.strictEqual(r.largestExpense.key, "wages");
  assert.strictEqual(r.largestExpense.amount, 3800);
  assert.strictEqual(r.largestExpense.pctOfRevenue, 0.38);
});

test("largest expense can be a custom row", function () {
  var r = build({ revenue: 10000, rent: 100, customExpenses: [{ label: "Loan interest", amount: 5000 }] });
  assert.strictEqual(r.largestExpense.key, "custom");
  assert.strictEqual(r.largestExpense.label, "Loan interest");
});

test("largest expense tie resolves to first in fixed order", function () {
  var r = build({ revenue: 10000, rent: 500, wages: 500 });
  assert.strictEqual(r.largestExpense.key, "rent");
});

test("largest expense null when no expense > 0", function () {
  var r = build({ revenue: 1000 });
  assert.strictEqual(r.largestExpense, null);
});

test("hasDepreciation only when depreciation > 0", function () {
  assert.strictEqual(build({ revenue: 1000, depreciation: 1 }).hasDepreciation, true);
  assert.strictEqual(build({ revenue: 1000 }).hasDepreciation, false);
});

test("revenue lines: sales line shown only when > 0; custom appended", function () {
  var r = build({ revenue: 500, customRevenue: [{ label: "Interest", amount: 50 }] });
  assert.strictEqual(r.revenueLines.length, 2);
  assert.strictEqual(r.revenueLines[0].amount, 500);
  assert.strictEqual(r.revenueLines[1].label, "Interest");
  var r2 = build({ rent: 100 });  // no revenue
  assert.strictEqual(r2.revenueLines.length, 0);
});

test("returns null when nothing to compute", function () {
  assert.strictEqual(build({}), null);
  assert.strictEqual(build({ revenue: 0, rent: 0 }), null);
});

test("negative/NaN amounts are coerced to 0", function () {
  var r = build({ revenue: 1000, rent: -50, wages: NaN });
  assert.strictEqual(r.expenseLines[0].amount, 0);
  assert.strictEqual(r.expenseLines[1].amount, 0);
  assert.strictEqual(r.totalExpenses, 0);
});

console.log("\nAll " + passed + " tests passed.");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/income-statement.test.js`
Expected: FAIL — `Cannot find module '../income-statement.js'`.

- [ ] **Step 3: Write the module** — create `income-statement.js`:

```javascript
/* ============================================================
   LedgerLab — income-statement.js
   Pure logic for the Income Statement Builder (v1, single-step).
   No DOM here: unit-testable in Node and also attaches to
   window.IncomeStatement for the browser.

   Single-step: Total Revenue - Total Expenses = Net Income/Loss.
   ============================================================ */

(function (root) {
  "use strict";

  /** Round to 2 decimals (cents). */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /** Coerce to a finite, non-negative number (blank/NaN/negative -> 0). */
  function money(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  // Fixed expense categories, in statement order. `key` selects advice copy.
  var EXPENSE_KEYS = [
    { key: "rent", label: "Rent expense" },
    { key: "wages", label: "Wages expense" },
    { key: "supplies", label: "Supplies expense" },
    { key: "utilities", label: "Utilities expense" },
    { key: "depreciation", label: "Depreciation expense" },
    { key: "other", label: "Other expenses" },
  ];

  // Category-adaptive managerial review guidance (see spec §6).
  var ADVICE = {
    rent: "A manager would review the location's cost, the lease terms, and whether the space is being fully used.",
    wages: "A manager would review staffing levels, scheduling, productivity, and whether current revenue is high enough to support payroll.",
    supplies: "A manager would review purchasing, waste, vendor pricing, and how supplies are being used.",
    utilities: "A manager would review energy efficiency and investigate any unusual increases.",
    depreciation: "This is a non-cash expense tied to using long-term assets over time, not money leaving the business this period.",
    other: 'A manager would review the underlying items, since "Other" can hide significant costs that belong in their own category.',
    custom: "A manager would review the underlying items behind this line to understand what's driving the cost.",
  };

  function bandFor(margin) {
    if (margin < 0) return "loss";
    if (margin < 0.1) return "thin";
    if (margin < 0.2) return "healthy";
    return "strong";
  }

  /**
   * Build a single-step income statement view-model.
   * @param {object} inputs
   * @returns {object|null} null when there is nothing to compute.
   */
  function buildIncomeStatement(inputs) {
    inputs = inputs || {};

    var name = (inputs.name || "").toString();
    var period = (inputs.period || "").toString();

    // Revenue lines: sales/service (if > 0) + custom revenue rows (amount > 0).
    var revenueLines = [];
    var sales = money(inputs.revenue);
    if (sales > 0) revenueLines.push({ label: "Sales / service revenue", amount: sales });
    (inputs.customRevenue || []).forEach(function (row) {
      var amt = money(row && row.amount);
      var label = ((row && row.label) || "").toString().trim();
      if (amt > 0 && label !== "") revenueLines.push({ label: label, amount: amt });
    });

    // Expense lines: six fixed (always) + custom expense rows (amount > 0).
    var expenseLines = EXPENSE_KEYS.map(function (cat) {
      return { label: cat.label, amount: money(inputs[cat.key]), key: cat.key };
    });
    (inputs.customExpenses || []).forEach(function (row) {
      var amt = money(row && row.amount);
      var label = ((row && row.label) || "").toString().trim();
      if (amt > 0 && label !== "") expenseLines.push({ label: label, amount: amt, key: "custom" });
    });

    var totalRevenue = round2(
      revenueLines.reduce(function (s, l) { return s + l.amount; }, 0)
    );
    var totalExpenses = round2(
      expenseLines.reduce(function (s, l) { return s + l.amount; }, 0)
    );

    if (totalRevenue === 0 && totalExpenses === 0) return null;

    var netIncome = round2(totalRevenue - totalExpenses);
    var margin = totalRevenue > 0 ? netIncome / totalRevenue : null;
    var marginBand = margin === null ? null : bandFor(margin);
    var centsKept = margin === null ? null : Math.round(margin * 100);

    // Largest expense across every line with amount > 0 (fixed order, then custom).
    var largestExpense = null;
    expenseLines.forEach(function (l) {
      if (l.amount > 0 && (largestExpense === null || l.amount > largestExpense.amount)) {
        largestExpense = {
          label: l.label,
          amount: l.amount,
          key: l.key,
          pctOfRevenue: totalRevenue > 0 ? round2(l.amount / totalRevenue) : null,
        };
      }
    });

    return {
      name: name,
      period: period,
      revenueLines: revenueLines,
      expenseLines: expenseLines,
      totalRevenue: totalRevenue,
      totalExpenses: totalExpenses,
      netIncome: netIncome,
      isLoss: netIncome < 0,
      margin: margin,
      marginBand: marginBand,
      centsKept: centsKept,
      largestExpense: largestExpense,
      hasDepreciation: money(inputs.depreciation) > 0,
    };
  }

  var api = {
    round2: round2,
    EXPENSE_KEYS: EXPENSE_KEYS,
    ADVICE: ADVICE,
    buildIncomeStatement: buildIncomeStatement,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.IncomeStatement = api;
  }
})(typeof self !== "undefined" ? self : this);
```

Note on the boundary test: the test file has one line asserting `rent:90` is `thin` immediately followed by re-asserting it is `healthy`; when writing, keep only the `healthy` assertion for the 10% case (10% is healthy by `bandFor`). Fix that line during Step 1 so the suite is internally consistent (margin exactly 0.10 → `healthy`).

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/income-statement.test.js`
Expected: `All N tests passed.`

- [ ] **Step 5: Commit**

```bash
git add income-statement.js tests/income-statement.test.js
git commit -m "Add income-statement.js pure logic + tests"
```

---

### Task 2: Add the tool UI to `index.html`

**Files:**
- Modify: `index.html` — insert a new tool block after the Depreciation Calculator tool (after line ~1242, the closing of `dep-tool`), inside `#tools`; add `<script src="income-statement.js"></script>` before `script.js` (line ~1262).

**Interfaces:**
- Consumes: `window.IncomeStatement` (Task 1).
- Produces: DOM ids consumed by Task 4 — `is-form`, `is-name`, `is-period`, `is-revenue`, `is-rent`, `is-wages`, `is-supplies`, `is-utilities`, `is-depreciation`, `is-other`, `is-custom-revenue` (rows container), `is-add-revenue` (button), `is-custom-expenses` (rows container), `is-add-expense` (button), `is-reset`, `is-results`, `is-empty`, `is-dashboard`, `is-title`, `is-out-revenue`, `is-out-expenses`, `is-out-net`, `is-out-net-label`, `is-out-margin`, `is-statement-revenue` (tbody), `is-statement-expenses` (tbody), `is-total-revenue`, `is-total-expenses`, `is-net-line`, `is-net-line-label`, `is-explanation-list`, `is-advice`, `is-dep-note`.

- [ ] **Step 1:** Insert the tool block. Immediately after the Depreciation tool's closing `</div>` for `dep-tool` (the `</div>` on line ~1242 that closes `<div class="je-tool br-tool dep-tool">`), add:

```html
        <!-- ---- Income Statement Builder ---- -->
        <div class="je-tool br-tool is-tool">
          <h3 class="tool-title">Income Statement Builder</h3>
          <p class="tool-sub">
            See how revenue and expenses become net income — or a net loss.
          </p>

          <div class="dep-intro">
            <p class="dep-intro-lead">
              An income statement (also called a profit &amp; loss statement) summarizes what a
              business earned and spent over a period of time. Revenue at the top, expenses below,
              and the difference is the profit — or loss — for the period.
            </p>
            <p class="dep-intro-sub">
              This builder uses the single-step format: add up all revenue, add up all expenses,
              and subtract. Blank amounts count as zero.
            </p>
          </div>

          <div class="sim-layout">
            <!-- Controls -->
            <form id="is-form" class="sim-panel sim-form" novalidate autocomplete="off">
              <h3 class="sim-panel-title">Business &amp; period</h3>
              <div class="field-row">
                <div class="field">
                  <label for="is-name">Business name</label>
                  <input type="text" id="is-name" name="is-name"
                         placeholder="e.g. Bluebird Cafe" autocomplete="off" />
                </div>
                <div class="field">
                  <label for="is-period">Period</label>
                  <input type="text" id="is-period" name="is-period"
                         placeholder="e.g. June 2026" autocomplete="off" />
                </div>
              </div>

              <h3 class="sim-panel-title">Revenue</h3>
              <div class="field field-full">
                <label for="is-revenue">Sales / service revenue</label>
                <div class="money-input">
                  <span class="money-symbol">$</span>
                  <input type="number" id="is-revenue" name="is-revenue"
                         min="0" step="0.01" inputmode="decimal" placeholder="0" />
                </div>
              </div>
              <div class="is-rows" id="is-custom-revenue"></div>
              <button type="button" class="btn btn-secondary is-add-btn" id="is-add-revenue">
                + Add revenue
              </button>

              <h3 class="sim-panel-title">Expenses</h3>
              <div class="field-row">
                <div class="field">
                  <label for="is-rent">Rent expense</label>
                  <div class="money-input">
                    <span class="money-symbol">$</span>
                    <input type="number" id="is-rent" name="is-rent"
                           min="0" step="0.01" inputmode="decimal" placeholder="0" />
                  </div>
                </div>
                <div class="field">
                  <label for="is-wages">Wages expense</label>
                  <div class="money-input">
                    <span class="money-symbol">$</span>
                    <input type="number" id="is-wages" name="is-wages"
                           min="0" step="0.01" inputmode="decimal" placeholder="0" />
                  </div>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="is-supplies">Supplies expense</label>
                  <div class="money-input">
                    <span class="money-symbol">$</span>
                    <input type="number" id="is-supplies" name="is-supplies"
                           min="0" step="0.01" inputmode="decimal" placeholder="0" />
                  </div>
                </div>
                <div class="field">
                  <label for="is-utilities">Utilities expense</label>
                  <div class="money-input">
                    <span class="money-symbol">$</span>
                    <input type="number" id="is-utilities" name="is-utilities"
                           min="0" step="0.01" inputmode="decimal" placeholder="0" />
                  </div>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="is-depreciation">Depreciation expense</label>
                  <div class="money-input">
                    <span class="money-symbol">$</span>
                    <input type="number" id="is-depreciation" name="is-depreciation"
                           min="0" step="0.01" inputmode="decimal" placeholder="0" />
                  </div>
                </div>
                <div class="field">
                  <label for="is-other">Other expenses</label>
                  <div class="money-input">
                    <span class="money-symbol">$</span>
                    <input type="number" id="is-other" name="is-other"
                           min="0" step="0.01" inputmode="decimal" placeholder="0" />
                  </div>
                </div>
              </div>
              <div class="is-rows" id="is-custom-expenses"></div>
              <button type="button" class="btn btn-secondary is-add-btn" id="is-add-expense">
                + Add expense
              </button>

              <div class="sim-actions">
                <button type="submit" class="btn btn-primary">Build statement</button>
                <button type="reset" class="btn btn-secondary" id="is-reset">Reset</button>
              </div>
            </form>

            <!-- Output -->
            <div class="sim-results" id="is-results" aria-live="polite">
              <div class="sim-empty" id="is-empty">
                <div class="card-icon" aria-hidden="true">📈</div>
                <h3>Your income statement appears here</h3>
                <p>
                  Enter revenue and expenses, then select
                  <strong>Build statement</strong>.
                </p>
              </div>

              <div class="sim-dashboard" id="is-dashboard" hidden>
                <h3 class="sim-dash-title" id="is-title">Income Statement</h3>

                <section class="report-section">
                  <h4 class="report-heading">Summary</h4>
                  <div class="stat-grid">
                    <div class="stat-card">
                      <span class="stat-label">Total Revenue</span>
                      <span class="stat-value" id="is-out-revenue">$0</span>
                    </div>
                    <div class="stat-card">
                      <span class="stat-label">Total Expenses</span>
                      <span class="stat-value" id="is-out-expenses">$0</span>
                    </div>
                    <div class="stat-card">
                      <span class="stat-label" id="is-out-net-label">Net Income</span>
                      <span class="stat-value" id="is-out-net">$0</span>
                    </div>
                    <div class="stat-card">
                      <span class="stat-label">Profit Margin</span>
                      <span class="stat-value" id="is-out-margin">—</span>
                    </div>
                  </div>
                </section>

                <section class="report-section">
                  <h4 class="report-heading">Income statement</h4>
                  <div class="preview-card">
                    <table class="preview-table is-statement">
                      <tbody>
                        <tr class="is-section-head"><td colspan="2">Revenue</td></tr>
                      </tbody>
                      <tbody id="is-statement-revenue"><!-- injected --></tbody>
                      <tbody>
                        <tr class="is-total-row">
                          <td>Total revenue</td>
                          <td class="num" id="is-total-revenue">—</td>
                        </tr>
                        <tr class="is-section-head"><td colspan="2">Expenses</td></tr>
                      </tbody>
                      <tbody id="is-statement-expenses"><!-- injected --></tbody>
                      <tbody>
                        <tr class="is-total-row">
                          <td>Total expenses</td>
                          <td class="num" id="is-total-expenses">—</td>
                        </tr>
                        <tr class="is-net-row" id="is-net-line">
                          <td id="is-net-line-label">Net income</td>
                          <td class="num" id="is-net-line-amount">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <div class="explanation is-explanation">
                  <h4 class="explanation-title">What this means</h4>
                  <ul class="explanation-list" id="is-explanation-list"><!-- injected --></ul>
                  <div class="is-advice" id="is-advice"><!-- injected --></div>
                  <p class="preview-note is-dep-note" id="is-dep-note" hidden>
                    Depreciation lowers profit but isn't a cash payment this period — your cash
                    didn't drop by this amount. It spreads the cost of a long-term asset over its
                    useful life.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 2:** Add the script tag. After `<script src="depreciation.js"></script>` (line ~1262), add:

```html
  <script src="income-statement.js"></script>
```

- [ ] **Step 3:** Sanity-check the HTML renders (open in browser). No JS wired yet, so the tool shows its empty state. Expected: the fourth tool appears under Depreciation with all fields and both "+ Add" buttons; empty results panel shows the 📈 card.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add Income Statement Builder markup to #tools"
```

---

### Task 3: Custom-row CSS

**Files:**
- Modify: `styles.css` — append a small block (near the other `dep-`/tool styles).

**Interfaces:**
- Consumes: classes emitted by Task 2/Task 4 (`is-rows`, `is-row`, `is-add-btn`, `is-row-remove`, `is-section-head`, `is-total-row`, `is-net-row`, `is-loss`, `is-advice`).
- Produces: layout only.

- [ ] **Step 1:** Append to `styles.css`:

```css
/* ===== Income Statement Builder ===== */
.is-rows { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }
.is-row { display: flex; gap: 0.5rem; align-items: flex-start; }
.is-row .is-row-label { flex: 1 1 auto; }
.is-row .is-row-amount { flex: 0 0 10rem; }
.is-row-remove {
  flex: 0 0 auto; align-self: center; border: none; background: transparent;
  cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0.25rem 0.4rem;
  color: var(--muted, #6b7280); border-radius: 6px;
}
.is-row-remove:hover { color: var(--danger, #dc2626); background: rgba(0,0,0,0.05); }
.is-add-btn { align-self: flex-start; margin-bottom: 0.5rem; }

.is-statement .is-section-head td {
  font-weight: 600; padding-top: 0.6rem; border-bottom: none;
}
.is-statement .is-total-row td { font-weight: 600; }
.is-statement .is-net-row td {
  font-weight: 700; border-top: 2px solid var(--border, #e5e7eb);
}
.is-statement .is-net-row.is-loss td { color: var(--danger, #dc2626); }

.is-advice {
  margin-top: 0.75rem; padding: 0.75rem 1rem;
  background: var(--surface-alt, #f8fafc);
  border-left: 3px solid var(--accent, #2563eb); border-radius: 6px;
}
.is-advice-lead { font-weight: 600; margin: 0 0 0.25rem; }
.is-advice-body { margin: 0; }
```

- [ ] **Step 2:** Verify in browser that the (still empty) tool is unbroken and dark mode still looks right. Expected: no layout regressions.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "Add Income Statement Builder custom-row + statement styles"
```

---

### Task 4: Wire up behavior in `script.js`

**Files:**
- Modify: `script.js` — add an Income Statement section after `initDepreciation`'s block (after line ~2198), and register `initIncomeStatement()` + `resetIncomeStatement()` in both the `DOMContentLoaded` handler (line ~2200) and the `pageshow` handler (line ~2218).

**Interfaces:**
- Consumes: `window.IncomeStatement` (Task 1); helpers `formatMoney`, `showError`, `clearError`, `getFieldWrapper`; DOM ids from Task 2.
- Produces: `initIncomeStatement`, `resetIncomeStatement` (registered in lifecycle).

- [ ] **Step 1:** Insert this block immediately before `document.addEventListener("DOMContentLoaded", ...)` (line ~2200):

```javascript
  /* ==========================================================
     Income Statement Builder (fourth Accounting Tool)
     Reads pure logic from income-statement.js
     (window.IncomeStatement). Single-step: revenue - expenses.
     ========================================================== */

  var IS_FIXED_FIELDS = [
    "is-revenue", "is-rent", "is-wages", "is-supplies",
    "is-utilities", "is-depreciation", "is-other",
  ];

  function isValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  // Apply the same money sanitizing initMoneyInputs() uses, for inputs added
  // dynamically after page load (custom rows).
  function attachMoneySanitizer(input) {
    var blockedKeys = ["e", "E", "+", "-"];
    input.addEventListener("keydown", function (event) {
      if (blockedKeys.indexOf(event.key) !== -1) event.preventDefault();
    });
    input.addEventListener("input", function () {
      var cleaned = input.value.replace(/[^0-9.]/g, "");
      var firstDot = cleaned.indexOf(".");
      if (firstDot !== -1) {
        cleaned = cleaned.slice(0, firstDot + 1) +
          cleaned.slice(firstDot + 1).replace(/\./g, "");
      }
      if (cleaned !== input.value) input.value = cleaned;
    });
  }

  // Build one custom row (label + amount + remove). `kind` is "revenue"|"expense".
  function isAddCustomRow(kind) {
    var container = document.getElementById(
      kind === "revenue" ? "is-custom-revenue" : "is-custom-expenses"
    );
    if (!container) return;
    var row = document.createElement("div");
    row.className = "is-row field"; // .field so showError/clearError can attach
    var placeholder = kind === "revenue" ? "e.g. Interest income" : "e.g. Marketing";
    row.innerHTML =
      '<input type="text" class="is-row-label" placeholder="' + placeholder + '" autocomplete="off" />' +
      '<div class="money-input is-row-amount">' +
        '<span class="money-symbol">$</span>' +
        '<input type="number" class="is-row-amount-input" min="0" step="0.01" inputmode="decimal" placeholder="0" />' +
      "</div>" +
      '<button type="button" class="is-row-remove" aria-label="Remove row">✕</button>';
    container.appendChild(row);
    attachMoneySanitizer(row.querySelector(".is-row-amount-input"));
    row.querySelector(".is-row-remove").addEventListener("click", function () {
      row.parentNode.removeChild(row);
    });
  }

  // Collect { label, amount } from a custom-row container.
  function isCollectRows(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return [];
    var rows = [];
    container.querySelectorAll(".is-row").forEach(function (row) {
      var label = (row.querySelector(".is-row-label").value || "").trim();
      var amount = row.querySelector(".is-row-amount-input").value;
      rows.push({ label: label, amount: amount, _row: row });
    });
    return rows;
  }

  // Validate: fixed money fields >= 0; custom rows need both label and amount
  // (or be fully blank). Returns true when valid.
  function validateIncomeStatement() {
    var ok = true;
    var firstInvalid = null;

    IS_FIXED_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      var raw = (input.value || "").trim();
      if (raw === "") { clearError(input); return; }
      var n = Number(raw);
      if (isNaN(n) || !isFinite(n) || n < 0) {
        showError(input, "Enter 0 or more.");
        ok = false;
        if (!firstInvalid) firstInvalid = input;
      } else {
        clearError(input);
      }
    });

    ["is-custom-revenue", "is-custom-expenses"].forEach(function (cid) {
      isCollectRows(cid).forEach(function (r) {
        var labelInput = r._row.querySelector(".is-row-label");
        var hasLabel = r.label !== "";
        var hasAmount = (r.amount || "").trim() !== "" && Number(r.amount) > 0;
        if (hasLabel !== hasAmount) {
          showError(labelInput, "Add both a name and an amount, or remove the row.");
          ok = false;
          if (!firstInvalid) firstInvalid = labelInput;
        } else {
          clearError(labelInput);
        }
      });
    });

    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  function isBandCopy(band) {
    switch (band) {
      case "loss": return "This period is a net loss — the business spent more than it earned.";
      case "thin": return "This is a thin margin — a small buffer between revenue and costs.";
      case "healthy": return "This is a healthy margin for many small businesses.";
      case "strong": return "This is a strong margin.";
      default: return "";
    }
  }

  function renderIncomeStatement(result) {
    var empty = document.getElementById("is-empty");
    var dashboard = document.getElementById("is-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    var title = "Income Statement";
    if (result.name.trim()) title = result.name.trim() + " — Income Statement";
    if (result.period.trim()) title += " (" + result.period.trim() + ")";
    setText("is-title", title);

    // Summary cards
    setText("is-out-revenue", formatMoney(result.totalRevenue));
    setText("is-out-expenses", formatMoney(result.totalExpenses));
    setText("is-out-net-label", result.isLoss ? "Net Loss" : "Net Income");
    setText("is-out-net", result.isLoss
      ? "(" + formatMoney(Math.abs(result.netIncome)) + ")"
      : formatMoney(result.netIncome));
    setText("is-out-margin", result.margin === null
      ? "—" : Math.round(result.margin * 100) + "%");

    var netCard = document.getElementById("is-out-net");
    if (netCard) netCard.classList.toggle("is-loss", result.isLoss);

    // Statement body
    var revBody = document.getElementById("is-statement-revenue");
    if (revBody) {
      revBody.innerHTML = "";
      if (result.revenueLines.length === 0) {
        revBody.innerHTML = '<tr><td class="is-empty-line">No revenue entered</td><td class="num">' +
          formatMoney(0) + "</td></tr>";
      } else {
        result.revenueLines.forEach(function (l) {
          var tr = document.createElement("tr");
          tr.innerHTML = "<td>" + escapeHtml(l.label) + "</td>" +
            '<td class="num">' + formatMoney(l.amount) + "</td>";
          revBody.appendChild(tr);
        });
      }
    }
    setText("is-total-revenue", formatMoney(result.totalRevenue));

    var expBody = document.getElementById("is-statement-expenses");
    if (expBody) {
      expBody.innerHTML = "";
      result.expenseLines.forEach(function (l) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + escapeHtml(l.label) + "</td>" +
          '<td class="num">' + formatMoney(l.amount) + "</td>";
        expBody.appendChild(tr);
      });
    }
    setText("is-total-expenses", formatMoney(result.totalExpenses));

    setText("is-net-line-label", result.isLoss ? "Net loss" : "Net income");
    setText("is-net-line-amount", result.isLoss
      ? "(" + formatMoney(Math.abs(result.netIncome)) + ")"
      : formatMoney(result.netIncome));
    var netLine = document.getElementById("is-net-line");
    if (netLine) netLine.classList.toggle("is-loss", result.isLoss);

    // Explanation list
    var list = document.getElementById("is-explanation-list");
    if (list) {
      list.innerHTML = "";
      var notes = [];
      if (result.margin !== null) {
        if (result.isLoss) {
          notes.push("The business spent more than it earned this period, so there is no profit to keep — expenses were " +
            formatMoney(result.totalExpenses) + " against " + formatMoney(result.totalRevenue) + " of revenue.");
        } else {
          notes.push("You keep " + result.centsKept + "¢ of every $1 of revenue — that's your net profit margin of " +
            Math.round(result.margin * 100) + "%.");
        }
        notes.push(isBandCopy(result.marginBand) +
          " These margin categories are general planning signals, not industry benchmarks. Healthy margins vary by industry and business model.");
      } else {
        notes.push("Profit margin needs revenue to be meaningful — add revenue to see the margin for this period.");
      }
      notes.forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
    }

    // Manager's review (largest expense)
    var advice = document.getElementById("is-advice");
    if (advice) {
      if (result.largestExpense) {
        var le = result.largestExpense;
        var lead = le.label + " is the largest expense";
        if (le.pctOfRevenue !== null) {
          lead += " at " + Math.round(le.pctOfRevenue * 100) + "% of revenue";
        }
        lead += ".";
        var body = window.IncomeStatement.ADVICE[le.key] || window.IncomeStatement.ADVICE.custom;
        advice.innerHTML =
          '<p class="is-advice-lead">Manager’s review</p>' +
          '<p class="is-advice-body">' + escapeHtml(lead) + " " + escapeHtml(body) + "</p>";
        advice.hidden = false;
      } else {
        advice.innerHTML = "";
        advice.hidden = true;
      }
    }

    // Depreciation note
    var depNote = document.getElementById("is-dep-note");
    if (depNote) depNote.hidden = !result.hasDepreciation;
  }

  function resetIncomeStatement() {
    IS_FIXED_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (input) { input.value = ""; clearError(input); }
    });
    ["is-name", "is-period"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.value = "";
    });
    ["is-custom-revenue", "is-custom-expenses"].forEach(function (id) {
      var c = document.getElementById(id);
      if (c) c.innerHTML = "";
    });
    var empty = document.getElementById("is-empty");
    var dashboard = document.getElementById("is-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initIncomeStatement() {
    var form = document.getElementById("is-form");
    if (!form) return;
    if (!window.IncomeStatement) return;

    var addRev = document.getElementById("is-add-revenue");
    var addExp = document.getElementById("is-add-expense");
    if (addRev) addRev.addEventListener("click", function () { isAddCustomRow("revenue"); });
    if (addExp) addExp.addEventListener("click", function () { isAddCustomRow("expense"); });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateIncomeStatement()) return;
      var result = window.IncomeStatement.buildIncomeStatement({
        name: isValue("is-name"),
        period: isValue("is-period"),
        revenue: isValue("is-revenue"),
        rent: isValue("is-rent"),
        wages: isValue("is-wages"),
        supplies: isValue("is-supplies"),
        utilities: isValue("is-utilities"),
        depreciation: isValue("is-depreciation"),
        other: isValue("is-other"),
        customRevenue: isCollectRows("is-custom-revenue"),
        customExpenses: isCollectRows("is-custom-expenses"),
      });
      if (result) {
        renderIncomeStatement(result);
      } else {
        // Nothing entered: keep the empty state, nudge the revenue field.
        var rev = document.getElementById("is-revenue");
        if (rev) showError(rev, "Enter some revenue or expenses to build a statement.");
      }
    });

    form.addEventListener("reset", function () {
      window.setTimeout(resetIncomeStatement, 0);
    });
  }
```

- [ ] **Step 2:** Confirm a tiny `escapeHtml` helper exists; if not, add one near the top helpers (after `formatMoneyCompact`). Search `script.js` for `function escapeHtml`. If absent, add:

```javascript
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
```

- [ ] **Step 3:** Register in the `DOMContentLoaded` handler — add `initIncomeStatement();` after `initDepreciation();` and `resetIncomeStatement();` after `resetDepreciation();`:

```javascript
    initDepreciation();
    initIncomeStatement();
    resetSimulatorState();
    resetJournalEntry();
    resetBankReconciliation();
    resetDepreciation();
    resetIncomeStatement();
```

- [ ] **Step 4:** Register in the `pageshow` handler — add `resetIncomeStatement();` after `resetDepreciation();`:

```javascript
  window.addEventListener("pageshow", function () {
    resetSimulatorState();
    resetJournalEntry();
    resetBankReconciliation();
    resetDepreciation();
    resetIncomeStatement();
  });
```

- [ ] **Step 5: Commit**

```bash
git add script.js
git commit -m "Wire up Income Statement Builder behavior"
```

---

### Task 5: Verification

**Files:** none (verification only).

- [ ] **Step 1: Run the new tests**

Run: `node tests/income-statement.test.js`
Expected: `All N tests passed.`

- [ ] **Step 2: Run the other three tool suites (no regressions)**

Run:
```bash
node tests/journal-entry.test.js
node tests/bank-reconciliation.test.js
node tests/depreciation.test.js
```
Expected: each prints `All … tests passed.`

- [ ] **Step 3: Manual browser check** — open `index.html`. Verify the checklist in spec §8:
  - Build a positive example (revenue 15000; rent 3000, wages 6000, supplies 800, utilities 700, depreciation 500, other 400) → Net Income $3,600.00, margin 24%, "keep 24¢" line, general-planning-signal framing, Manager's review names Wages, depreciation note visible.
  - Net loss example (revenue 1000, rent 1500) → Net Loss (500.00) in loss color, band = loss.
  - Zero revenue (rent 500 only) → margin "—", revenue-needed note.
  - Add a custom revenue row and a custom expense row; make one the largest → Manager's review adapts (`custom` copy).
  - Custom row with a label but no amount → validation error; reset clears everything; refresh (bfcache) returns to empty state.
  - Depreciation = 0 → note hidden. Two-panel → stacked on narrow width; dark mode intact.

- [ ] **Step 4:** No commit (verification only). Report files changed, test results, manual-check list, and `git status`.

---

## Notes for the implementer

- Keep everything ES5-style (`var`, function declarations, IIFE) to match the codebase.
- Only touch the `#tools` region of `index.html`; do not alter other sections.
- The margin-band framing copy is required verbatim: "These margin categories are general planning signals, not industry benchmarks. Healthy margins vary by industry and business model."
