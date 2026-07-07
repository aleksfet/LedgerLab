# Cash Flow Helper v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build LedgerLab's fifth Accounting Tool — a beginner-friendly, simplified Statement of Cash Flows that auto-classifies 9 preset cash transactions into Operating / Investing / Financing, subtotals each, and reconciles beginning → ending cash.

**Architecture:** Pure logic (`cash-flow.js`, dual-export, `window.CashFlow`) + Node tests, a two-panel UI block in `index.html`, minimal `cf-` CSS reusing existing components, and `initCashFlow()` wiring in `script.js`. Mirrors the Income Statement Builder exactly.

**Tech Stack:** Vanilla ES5-style JS (no libraries), Node built-in `assert` for tests, static HTML/CSS.

## Global Constraints

- No external libraries; dual-export pattern `(window.CashFlow / module.exports)`.
- Money coercion: blank/NaN/negative → 0; round to cents via `round2`.
- Prefix all ids/classes `cf-`.
- Do NOT change calculations or markup of the other four tools.
- 9 preset transactions only; automatic classification; no custom/free-text transactions.
- Reuse existing helpers in `script.js`: `formatMoney`, `escapeHtml`, `showError`, `clearError`, `attachMoneySanitizer`.
- Tests run with `node tests/cash-flow.test.js` (no package.json).

---

### Task 1: Pure logic `cash-flow.js` + Node tests

**Files:**
- Create: `cash-flow.js`
- Test: `tests/cash-flow.test.js`

**Interfaces:**
- Produces: `CashFlow.buildCashFlow(inputs)` → view-model or `null`; `CashFlow.CATALOG` (array of `{id,label,category,direction}`); `CashFlow.round2`.
- Input: `{ name, period, beginningCash, transactions: [{ type, amount }] }`.
- View-model: `{ name, period, beginningCash, endingCash, operating:{lines:[{label,amount}],subtotal}, investing:{...}, financing:{...}, netChange, isNetPositive, flags:{hasEquipmentPurchase, hasOwnerInvestment, reliedOnFinancing} }`. `amount` on lines is signed.

- [ ] **Step 1: Write the failing tests** — `tests/cash-flow.test.js`

```js
/* ============================================================
   Tests for cash-flow.js
   Run with: node tests/cash-flow.test.js
   Uses only the built-in assert module (no external libraries).
   ============================================================ */
"use strict";
var assert = require("assert");
var CF = require("../cash-flow.js");
var build = CF.buildCashFlow;

var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok - " + name); }

console.log("cash-flow.js");

test("classifies each preset into the right section with the right sign", function () {
  var r = build({ transactions: [
    { type: "cust", amount: 100 }, { type: "rent", amount: 40 },
    { type: "buy-equip", amount: 30 }, { type: "sell-equip", amount: 10 },
    { type: "owner-invest", amount: 50 }, { type: "loan-principal", amount: 20 },
  ]});
  assert.strictEqual(r.operating.subtotal, 60);   // +100 - 40
  assert.strictEqual(r.investing.subtotal, -20);  // -30 + 10
  assert.strictEqual(r.financing.subtotal, 30);   // +50 - 20
  assert.strictEqual(r.operating.lines[0].amount, 100);
  assert.strictEqual(r.operating.lines[1].amount, -40);
});

test("net change = sum of subtotals; ending = beginning + net change", function () {
  var r = build({ beginningCash: 1000, transactions: [
    { type: "cust", amount: 500 }, { type: "wages", amount: 200 },
    { type: "buy-equip", amount: 300 }, { type: "loan-proceeds", amount: 100 },
  ]});
  assert.strictEqual(r.operating.subtotal, 300);
  assert.strictEqual(r.investing.subtotal, -300);
  assert.strictEqual(r.financing.subtotal, 100);
  assert.strictEqual(r.netChange, 100);
  assert.strictEqual(r.endingCash, 1100);
  assert.strictEqual(r.isNetPositive, true);
});

test("negative net change flips isNetPositive false", function () {
  var r = build({ beginningCash: 500, transactions: [
    { type: "rent", amount: 400 }, { type: "wages", amount: 300 },
  ]});
  assert.strictEqual(r.netChange, -700);
  assert.strictEqual(r.endingCash, -200);
  assert.strictEqual(r.isNetPositive, false);
});

test("blank/missing beginning cash counts as 0", function () {
  var r = build({ transactions: [{ type: "cust", amount: 250 }] });
  assert.strictEqual(r.beginningCash, 0);
  assert.strictEqual(r.endingCash, 250);
});

test("negative and NaN amounts are coerced to 0 (row skipped)", function () {
  var r = build({ transactions: [
    { type: "cust", amount: -5 }, { type: "rent", amount: "abc" },
    { type: "wages", amount: 100 },
  ]});
  assert.strictEqual(r.operating.subtotal, -100);
  assert.strictEqual(r.operating.lines.length, 1);
});

test("unknown transaction types and amount<=0 rows are skipped", function () {
  var r = build({ transactions: [
    { type: "mystery", amount: 100 }, { type: "cust", amount: 0 },
    { type: "cust", amount: 80 },
  ]});
  assert.strictEqual(r.operating.lines.length, 1);
  assert.strictEqual(r.operating.subtotal, 80);
});

test("returns null when there are no valid transactions", function () {
  assert.strictEqual(build({ transactions: [] }), null);
  assert.strictEqual(build({ beginningCash: 999, transactions: [{ type: "x", amount: 5 }] }), null);
});

test("flags: hasEquipmentPurchase and hasOwnerInvestment", function () {
  var r = build({ transactions: [
    { type: "buy-equip", amount: 100 }, { type: "owner-invest", amount: 200 },
  ]});
  assert.strictEqual(r.flags.hasEquipmentPurchase, true);
  assert.strictEqual(r.flags.hasOwnerInvestment, true);
});

test("reliedOnFinancing true only when operating<0 AND financing>0", function () {
  var relied = build({ transactions: [
    { type: "rent", amount: 500 }, { type: "owner-invest", amount: 800 },
  ]});
  assert.strictEqual(relied.flags.reliedOnFinancing, true);
  var positiveOp = build({ transactions: [
    { type: "cust", amount: 500 }, { type: "owner-invest", amount: 800 },
  ]});
  assert.strictEqual(positiveOp.flags.reliedOnFinancing, false);
  var noFinancing = build({ transactions: [{ type: "rent", amount: 500 }] });
  assert.strictEqual(noFinancing.flags.reliedOnFinancing, false);
});

test("subtotals, net change, and ending cash round to cents", function () {
  var r = build({ beginningCash: 0.005, transactions: [
    { type: "cust", amount: 10.005 }, { type: "rent", amount: 0.004 },
  ]});
  assert.strictEqual(r.operating.subtotal, 10.0);
  assert.strictEqual(r.netChange, 10.0);
});

console.log("\nAll " + passed + " tests passed.");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/cash-flow.test.js`
Expected: FAIL — `Cannot find module '../cash-flow.js'`.

- [ ] **Step 3: Write `cash-flow.js`**

```js
/* ============================================================
   LedgerLab — cash-flow.js
   Pure logic for the Cash Flow Helper (v1, simplified direct method).
   No DOM here: unit-testable in Node and also attaches to
   window.CashFlow for the browser.

   Groups preset cash transactions into Operating / Investing /
   Financing, subtotals each, then Net change + Beginning->Ending cash.
   ============================================================ */
(function (root) {
  "use strict";

  /** Round to 2 decimals (cents). */
  function round2(value) { return Math.round(value * 100) / 100; }

  /** Coerce to a finite, non-negative number (blank/NaN/negative -> 0). */
  function money(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  // Fixed catalog: each preset carries its category and cash direction.
  // direction "in" = cash inflow (+), "out" = cash outflow (-).
  var CATALOG = [
    { id: "cust", label: "Cash received from customers", category: "operating", direction: "in" },
    { id: "rent", label: "Paid rent", category: "operating", direction: "out" },
    { id: "wages", label: "Paid wages", category: "operating", direction: "out" },
    { id: "buy-equip", label: "Bought equipment", category: "investing", direction: "out" },
    { id: "sell-equip", label: "Sold equipment", category: "investing", direction: "in" },
    { id: "owner-invest", label: "Owner invested cash", category: "financing", direction: "in" },
    { id: "loan-proceeds", label: "Loan proceeds", category: "financing", direction: "in" },
    { id: "loan-principal", label: "Paid loan principal", category: "financing", direction: "out" },
    { id: "owner-withdraw", label: "Owner withdrew cash", category: "financing", direction: "out" },
  ];

  var CATALOG_BY_ID = {};
  CATALOG.forEach(function (c) { CATALOG_BY_ID[c.id] = c; });

  /**
   * Build a simplified statement-of-cash-flows view-model.
   * @param {object} inputs - { name, period, beginningCash,
   *   transactions:[{ type, amount }] }
   * @returns {object|null} null when there is nothing to compute.
   */
  function buildCashFlow(inputs) {
    inputs = inputs || {};
    var name = (inputs.name || "").toString();
    var period = (inputs.period || "").toString();
    var beginningCash = round2(money(inputs.beginningCash));

    var buckets = {
      operating: { lines: [], subtotal: 0 },
      investing: { lines: [], subtotal: 0 },
      financing: { lines: [], subtotal: 0 },
    };
    var flags = {
      hasEquipmentPurchase: false,
      hasOwnerInvestment: false,
      reliedOnFinancing: false,
    };

    var count = 0;
    (inputs.transactions || []).forEach(function (row) {
      var cat = CATALOG_BY_ID[row && row.type];
      var amt = money(row && row.amount);
      if (!cat || amt <= 0) return;
      var signed = cat.direction === "in" ? amt : -amt;
      buckets[cat.category].lines.push({ label: cat.label, amount: signed });
      count++;
      if (cat.id === "buy-equip") flags.hasEquipmentPurchase = true;
      if (cat.id === "owner-invest") flags.hasOwnerInvestment = true;
    });

    if (count === 0) return null;

    ["operating", "investing", "financing"].forEach(function (k) {
      buckets[k].subtotal = round2(
        buckets[k].lines.reduce(function (s, l) { return s + l.amount; }, 0)
      );
    });

    var netChange = round2(
      buckets.operating.subtotal + buckets.investing.subtotal + buckets.financing.subtotal
    );
    var endingCash = round2(beginningCash + netChange);

    flags.reliedOnFinancing =
      buckets.operating.subtotal < 0 && buckets.financing.subtotal > 0;

    return {
      name: name,
      period: period,
      beginningCash: beginningCash,
      endingCash: endingCash,
      operating: buckets.operating,
      investing: buckets.investing,
      financing: buckets.financing,
      netChange: netChange,
      isNetPositive: netChange >= 0,
      flags: flags,
    };
  }

  var api = { round2: round2, CATALOG: CATALOG, buildCashFlow: buildCashFlow };

  // Dual export: Node (tests) + browser (window.CashFlow). No libraries.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CashFlow = api;
  }
})(typeof self !== "undefined" ? self : this);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/cash-flow.test.js`
Expected: PASS — "All 10 tests passed."

- [ ] **Step 5: Commit**

```
git add cash-flow.js tests/cash-flow.test.js
git commit -m "Add cash-flow.js pure logic + tests"
```

---

### Task 2: HTML markup — fifth tool block

**Files:**
- Modify: `index.html` (add tool block after the Income Statement `.is-tool` closing `</div>`, before `</div></section>`; add `<script src="cash-flow.js">` before `script.js`).

**Interfaces:**
- Consumes: `CashFlow` (loaded via new script tag).
- Produces: DOM ids used by Task 4 — `cf-form`, `cf-name`, `cf-period`, `cf-beginning`, `cf-transactions`, `cf-add`, `cf-reset`, `cf-empty`, `cf-dashboard`, `cf-title`, `cf-out-operating`, `cf-out-investing`, `cf-out-financing`, `cf-out-net`, `cf-out-net-label`, section bodies `cf-stmt-operating|investing|financing`, subtotal cells `cf-sub-operating|investing|financing`, `cf-net-line`, `cf-begin-line`, `cf-end-line`, `cf-tailored`, `cf-insight`; example buttons `.cf-example-btn` with `data-example`.

- [ ] **Step 1: Insert the tool block** immediately after the Income Statement Builder's closing `</div>` (the `.is-tool` block ends just before `</div>\n    </section>`):

```html
        <!-- ---- Cash Flow Helper ---- -->
        <div class="je-tool br-tool cf-tool">
          <h3 class="tool-title">Cash Flow Helper</h3>
          <p class="tool-sub">
            See how cash actually moves — and why profit isn't the same as cash.
          </p>

          <div class="dep-intro">
            <p class="dep-intro-lead">
              The Statement of Cash Flows groups a business's cash movements into three activities:
              Operating, Investing, and Financing.
            </p>
            <div class="is-how">
              <h4 class="is-how-title">How this works</h4>
              <p class="is-how-body">
                Pick the cash transactions that happened this period. LedgerLab sorts each one into
                the right activity, subtotals each section, and reconciles your beginning cash to
                your ending cash.
              </p>
            </div>
          </div>

          <div class="is-examples-wrap">
            <p class="is-examples-label">New here? Try an example:</p>
            <div class="is-examples">
              <button type="button" class="btn btn-secondary cf-example-btn" data-example="healthy">
                Healthy Month
              </button>
              <button type="button" class="btn btn-secondary cf-example-btn" data-example="startup">
                Startup Launch
              </button>
              <button type="button" class="btn btn-secondary cf-example-btn" data-example="upgrade">
                Equipment Upgrade
              </button>
            </div>
          </div>

          <div class="sim-layout">
            <!-- Controls -->
            <form id="cf-form" class="sim-panel sim-form" novalidate autocomplete="off">
              <h3 class="sim-panel-title">Business &amp; cash</h3>
              <div class="field-row">
                <div class="field">
                  <label for="cf-name">Business name</label>
                  <input type="text" id="cf-name" name="cf-name"
                         placeholder="e.g. Bluebird Cafe" autocomplete="off" />
                </div>
                <div class="field">
                  <label for="cf-period">Period</label>
                  <input type="text" id="cf-period" name="cf-period"
                         placeholder="e.g. June 2026" autocomplete="off" />
                </div>
              </div>
              <div class="field field-full">
                <label for="cf-beginning">Beginning cash balance</label>
                <div class="money-input">
                  <span class="money-symbol">$</span>
                  <input type="number" id="cf-beginning" name="cf-beginning"
                         min="0" step="0.01" inputmode="decimal" placeholder="0" />
                </div>
              </div>

              <h3 class="sim-panel-title">Cash transactions</h3>
              <p class="is-section-help">
                Add the cash that came in or went out this period. LedgerLab classifies each
                transaction for you.
              </p>
              <div class="cf-rows" id="cf-transactions"></div>
              <button type="button" class="btn btn-secondary is-add-btn" id="cf-add">
                + Add transaction
              </button>
              <p class="is-add-help">
                Choose from common cash transactions such as customer payments, rent, wages,
                equipment, loans, and owner contributions.
              </p>

              <div class="sim-actions">
                <button type="submit" class="btn btn-primary">Build cash flow statement</button>
                <button type="reset" class="btn btn-secondary" id="cf-reset">Reset</button>
              </div>
            </form>

            <!-- Output -->
            <div class="sim-results" id="cf-results" aria-live="polite">
              <div class="sim-empty" id="cf-empty">
                <div class="card-icon" aria-hidden="true">💵</div>
                <h3>Your cash flow statement appears here</h3>
                <p>
                  Add a few cash transactions or try an example. LedgerLab will sort them into
                  Operating, Investing, and Financing activities, total each section, and show how
                  your cash changed this period.
                </p>
              </div>

              <div class="sim-dashboard" id="cf-dashboard" hidden>
                <h3 class="sim-dash-title" id="cf-title">Statement of Cash Flows</h3>

                <section class="report-section">
                  <h4 class="report-heading">Summary</h4>
                  <div class="stat-grid">
                    <div class="stat-card">
                      <span class="stat-label">Operating</span>
                      <span class="stat-value" id="cf-out-operating">$0</span>
                    </div>
                    <div class="stat-card">
                      <span class="stat-label">Investing</span>
                      <span class="stat-value" id="cf-out-investing">$0</span>
                    </div>
                    <div class="stat-card">
                      <span class="stat-label">Financing</span>
                      <span class="stat-value" id="cf-out-financing">$0</span>
                    </div>
                    <div class="stat-card">
                      <span class="stat-label" id="cf-out-net-label">Net Change in Cash</span>
                      <span class="stat-value" id="cf-out-net">$0</span>
                    </div>
                  </div>
                </section>

                <section class="report-section">
                  <h4 class="report-heading">Statement of Cash Flows</h4>
                  <div class="preview-card">
                    <table class="preview-table is-statement cf-statement">
                      <tbody>
                        <tr class="is-section-head"><td colspan="2">Operating activities</td></tr>
                      </tbody>
                      <tbody id="cf-stmt-operating"><!-- injected --></tbody>
                      <tbody>
                        <tr class="is-total-row">
                          <td>Net cash from operating activities</td>
                          <td class="num" id="cf-sub-operating">—</td>
                        </tr>
                        <tr class="is-section-head"><td colspan="2">Investing activities</td></tr>
                      </tbody>
                      <tbody id="cf-stmt-investing"><!-- injected --></tbody>
                      <tbody>
                        <tr class="is-total-row">
                          <td>Net cash from investing activities</td>
                          <td class="num" id="cf-sub-investing">—</td>
                        </tr>
                        <tr class="is-section-head"><td colspan="2">Financing activities</td></tr>
                      </tbody>
                      <tbody id="cf-stmt-financing"><!-- injected --></tbody>
                      <tbody>
                        <tr class="is-total-row">
                          <td>Net cash from financing activities</td>
                          <td class="num" id="cf-sub-financing">—</td>
                        </tr>
                        <tr class="is-net-row" id="cf-net-line">
                          <td>Net change in cash</td>
                          <td class="num" id="cf-net-line-amount">—</td>
                        </tr>
                        <tr class="cf-recon-row">
                          <td>Beginning cash balance</td>
                          <td class="num" id="cf-begin-line">—</td>
                        </tr>
                        <tr class="cf-recon-row cf-end-row">
                          <td>Ending cash balance</td>
                          <td class="num" id="cf-end-line">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <div class="explanation is-explanation">
                  <div class="is-tells">
                    <h4 class="explanation-title">What each activity means</h4>
                    <ul class="explanation-list">
                      <li><strong>Operating</strong> — cash from the day-to-day running of the
                        business, like selling to customers and paying rent and wages.</li>
                      <li><strong>Investing</strong> — cash from buying or selling long-term
                        assets, like equipment.</li>
                      <li><strong>Financing</strong> — cash from owners and lenders, like owner
                        contributions, withdrawals, and loans.</li>
                    </ul>
                  </div>
                  <div class="is-tells">
                    <h4 class="explanation-title">Why profit isn't the same as cash</h4>
                    <ul class="explanation-list">
                      <li><strong>Sale on account</strong> — revenue and profit can go up before
                        the cash is actually collected.</li>
                      <li><strong>Buy equipment for cash</strong> — cash drops now, but the whole
                        purchase isn't an immediate expense on the income statement.</li>
                      <li><strong>Owner invests cash</strong> — cash goes up, but it's financing,
                        not revenue or profit.</li>
                    </ul>
                    <div class="is-advice" id="cf-tailored" hidden><!-- injected --></div>
                  </div>
                  <div class="is-advice" id="cf-insight"><!-- injected --></div>
                </div>
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 2: Add the script tag** — modify the script list near the end of `index.html`:

```html
  <script src="income-statement.js"></script>
  <script src="cash-flow.js"></script>
  <script src="script.js"></script>
```

- [ ] **Step 3: Sanity check** — open `index.html`; the new tool renders with the empty state and example buttons (wiring comes in Task 4; buttons inert for now).

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "Add Cash Flow Helper markup to #tools"
```

---

### Task 3: CSS — minimal `cf-` styles

**Files:**
- Modify: `styles.css` (append after the income-statement `.is-*` rules block).

**Interfaces:**
- Consumes: existing `.is-statement`, `.preview-table`, `.stat-value`, `.is-advice`, `.field` classes.
- Produces: `.cf-row`, `.cf-row-select`, `.cf-recon-row`, `.cf-end-row`, `.stat-value.cf-pos`, `.stat-value.cf-neg`, `.cf-empty-line` styles.

- [ ] **Step 1: Append the styles**

```css
/* ---- Cash Flow Helper ---- */
.cf-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin-bottom: 0.6rem;
}
.cf-row-select { flex: 1 1 auto; }
.cf-row .is-row-amount { flex: 0 0 9rem; }
.cf-statement .cf-recon-row td { border-bottom: none; }
.cf-statement .cf-end-row td {
  font-weight: 700;
  border-top: 1px solid var(--border-strong);
}
.cf-empty-line { color: var(--text-muted); font-style: italic; }
.stat-value.cf-pos { color: var(--green); }
.stat-value.cf-neg { color: var(--red); }
```

- [ ] **Step 2: Sanity check** — reload; transaction rows (once added via Task 4) lay out as select + amount + remove; reconciliation lines and net-change color read correctly.

- [ ] **Step 3: Commit**

```
git add styles.css
git commit -m "Add Cash Flow Helper styles"
```

---

### Task 4: JS wiring in `script.js`

**Files:**
- Modify: `script.js` (add a Cash Flow Helper section after the Income Statement section; register `initCashFlow()` and `resetCashFlow()` in the `DOMContentLoaded` handler).

**Interfaces:**
- Consumes: `window.CashFlow.buildCashFlow`, `CashFlow.CATALOG`; helpers `formatMoney`, `escapeHtml`, `showError`, `clearError`, `attachMoneySanitizer`.
- Produces: `initCashFlow()`, `resetCashFlow()`.

- [ ] **Step 1: Add the Cash Flow section** — insert before `document.addEventListener("DOMContentLoaded", ...)`:

```js
  /* ==========================================================
     Cash Flow Helper (fifth Accounting Tool)
     Reads pure logic from cash-flow.js (window.CashFlow).
     Simplified direct method: transactions -> 3 activity sections.
     ========================================================== */

  var CF_EXAMPLES = {
    healthy: { name: "Bluebird Cafe", period: "June 2026", beginning: "4000", rows: [
      { type: "cust", amount: "20000" }, { type: "rent", amount: "3500" },
      { type: "wages", amount: "7000" }, { type: "buy-equip", amount: "5000" },
      { type: "loan-principal", amount: "1000" },
    ]},
    startup: { name: "Nimbus Labs", period: "June 2026", beginning: "1000", rows: [
      { type: "cust", amount: "2000" }, { type: "rent", amount: "1500" },
      { type: "wages", amount: "4000" }, { type: "buy-equip", amount: "3000" },
      { type: "owner-invest", amount: "5000" }, { type: "loan-proceeds", amount: "4000" },
    ]},
    upgrade: { name: "Ridgeline Goods", period: "June 2026", beginning: "8000", rows: [
      { type: "cust", amount: "15000" }, { type: "rent", amount: "3000" },
      { type: "wages", amount: "5000" }, { type: "buy-equip", amount: "9000" },
      { type: "sell-equip", amount: "1000" }, { type: "owner-withdraw", amount: "2000" },
    ]},
  };

  function cfValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  // Build one transaction row: catalog <select> (grouped) + amount + remove.
  function cfAddRow(presetType, presetAmount) {
    var container = document.getElementById("cf-transactions");
    if (!container || !window.CashFlow) return;
    var row = document.createElement("div");
    row.className = "cf-row field"; // .field so showError/clearError can attach

    var groups = { operating: "Operating", investing: "Investing", financing: "Financing" };
    var optsByGroup = { operating: "", investing: "", financing: "" };
    window.CashFlow.CATALOG.forEach(function (c) {
      optsByGroup[c.category] +=
        '<option value="' + c.id + '">' + escapeHtml(c.label) + "</option>";
    });
    var selectHtml = '<select class="cf-row-select"><option value="">Choose a transaction…</option>';
    ["operating", "investing", "financing"].forEach(function (g) {
      selectHtml += '<optgroup label="' + groups[g] + '">' + optsByGroup[g] + "</optgroup>";
    });
    selectHtml += "</select>";

    row.innerHTML =
      selectHtml +
      '<div class="money-input is-row-amount">' +
        '<span class="money-symbol">$</span>' +
        '<input type="number" class="cf-row-amount-input" min="0" step="0.01" inputmode="decimal" placeholder="0" />' +
      "</div>" +
      '<button type="button" class="is-row-remove" aria-label="Remove row">✕</button>';
    container.appendChild(row);
    attachMoneySanitizer(row.querySelector(".cf-row-amount-input"));
    row.querySelector(".is-row-remove").addEventListener("click", function () {
      row.parentNode.removeChild(row);
    });
    if (presetType) row.querySelector(".cf-row-select").value = presetType;
    if (presetAmount != null) row.querySelector(".cf-row-amount-input").value = presetAmount;
    return row;
  }

  // Collect { type, amount } from the transaction rows (with _row ref for errors).
  function cfCollectRows() {
    var container = document.getElementById("cf-transactions");
    if (!container) return [];
    var rows = [];
    container.querySelectorAll(".cf-row").forEach(function (row) {
      rows.push({
        type: row.querySelector(".cf-row-select").value,
        amount: row.querySelector(".cf-row-amount-input").value,
        _row: row,
      });
    });
    return rows;
  }

  // Beginning cash >= 0; each row must have both a type and amount>0, or be fully blank.
  function validateCashFlow() {
    var ok = true, firstInvalid = null;
    var begin = document.getElementById("cf-beginning");
    if (begin) {
      var raw = (begin.value || "").trim();
      if (raw !== "" && (isNaN(Number(raw)) || !isFinite(Number(raw)) || Number(raw) < 0)) {
        showError(begin, "Enter 0 or more."); ok = false; firstInvalid = begin;
      } else { clearError(begin); }
    }
    cfCollectRows().forEach(function (r) {
      var sel = r._row.querySelector(".cf-row-select");
      var hasType = r.type !== "";
      var hasAmount = (r.amount || "").trim() !== "" && Number(r.amount) > 0;
      if (hasType !== hasAmount) {
        showError(sel, "Pick a transaction and enter an amount, or remove the row.");
        ok = false; if (!firstInvalid) firstInvalid = sel;
      } else { clearError(sel); }
    });
    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  function cfSignedMoney(amount) {
    return (amount < 0 ? "-" : "") + formatMoney(Math.abs(amount)).replace("-", "");
  }

  function cfRenderSection(bodyId, lines) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    body.innerHTML = "";
    if (lines.length === 0) {
      body.innerHTML = '<tr><td class="cf-empty-line">None this period</td>' +
        '<td class="num">' + formatMoney(0) + "</td></tr>";
      return;
    }
    lines.forEach(function (l) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + escapeHtml(l.label) + "</td>" +
        '<td class="num">' + formatMoney(l.amount) + "</td>";
      body.appendChild(tr);
    });
  }

  function renderCashFlow(result) {
    var empty = document.getElementById("cf-empty");
    var dashboard = document.getElementById("cf-dashboard");
    if (empty) empty.hidden = true;
    if (dashboard) dashboard.hidden = false;

    var setText = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    var title = "Statement of Cash Flows";
    if (result.name.trim()) title = result.name.trim() + " — Statement of Cash Flows";
    if (result.period.trim()) title += " (" + result.period.trim() + ")";
    setText("cf-title", title);

    // Summary cards
    setText("cf-out-operating", formatMoney(result.operating.subtotal));
    setText("cf-out-investing", formatMoney(result.investing.subtotal));
    setText("cf-out-financing", formatMoney(result.financing.subtotal));
    setText("cf-out-net-label", result.isNetPositive ? "Net Increase in Cash" : "Net Decrease in Cash");
    setText("cf-out-net", formatMoney(result.netChange));
    var netCard = document.getElementById("cf-out-net");
    if (netCard) {
      netCard.classList.toggle("cf-pos", result.isNetPositive);
      netCard.classList.toggle("cf-neg", !result.isNetPositive);
    }

    // Statement sections + subtotals
    cfRenderSection("cf-stmt-operating", result.operating.lines);
    cfRenderSection("cf-stmt-investing", result.investing.lines);
    cfRenderSection("cf-stmt-financing", result.financing.lines);
    setText("cf-sub-operating", formatMoney(result.operating.subtotal));
    setText("cf-sub-investing", formatMoney(result.investing.subtotal));
    setText("cf-sub-financing", formatMoney(result.financing.subtotal));

    // Net change + reconciliation
    setText("cf-net-line-amount", formatMoney(result.netChange));
    var netLine = document.getElementById("cf-net-line");
    if (netLine) netLine.classList.toggle("is-loss", !result.isNetPositive);
    setText("cf-begin-line", formatMoney(result.beginningCash));
    setText("cf-end-line", formatMoney(result.endingCash));

    // Tailored callouts (profit != cash)
    var tailored = document.getElementById("cf-tailored");
    if (tailored) {
      var notes = [];
      if (result.flags.hasEquipmentPurchase) {
        notes.push("In your statement, equipment purchases reduced cash through Investing Activities.");
      }
      if (result.flags.hasOwnerInvestment) {
        notes.push("In your statement, owner investment increased cash through Financing Activities, not Operating Activities.");
      }
      if (notes.length) {
        tailored.innerHTML = notes.map(function (n) {
          return '<p class="is-advice-body">' + escapeHtml(n) + "</p>";
        }).join("");
        tailored.hidden = false;
      } else {
        tailored.innerHTML = ""; tailored.hidden = true;
      }
    }

    // Light business insight
    var insight = document.getElementById("cf-insight");
    if (insight) {
      var lead, body;
      if (result.flags.reliedOnFinancing) {
        lead = "Business insight";
        body = "This period, the business relied on owner or loan financing because operating cash flow was negative.";
      } else if (result.operating.subtotal > 0) {
        lead = "Business insight";
        body = "Operating cash flow was positive, so day-to-day operations generated cash this period.";
      } else {
        lead = "Business insight";
        body = "Operating activities were flat or negative this period — watch whether operations can fund the business on their own.";
      }
      insight.innerHTML =
        '<p class="is-advice-lead">' + lead + "</p>" +
        '<p class="is-advice-body">' + escapeHtml(body) + "</p>";
    }
  }

  function resetCashFlow() {
    ["cf-name", "cf-period"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });
    var begin = document.getElementById("cf-beginning");
    if (begin) { begin.value = ""; clearError(begin); }
    var c = document.getElementById("cf-transactions");
    if (c) c.innerHTML = "";
    var empty = document.getElementById("cf-empty");
    var dashboard = document.getElementById("cf-dashboard");
    if (dashboard) dashboard.hidden = true;
    if (empty) empty.hidden = false;
  }

  function initCashFlow() {
    var form = document.getElementById("cf-form");
    if (!form || !window.CashFlow) return;

    var add = document.getElementById("cf-add");
    if (add) add.addEventListener("click", function () { cfAddRow(); });

    function applyCfExample(key) {
      var ex = CF_EXAMPLES[key];
      if (!ex) return;
      resetCashFlow();
      var setVal = function (id, value) {
        var el = document.getElementById(id); if (el) { el.value = value; clearError(el); }
      };
      setVal("cf-name", ex.name);
      setVal("cf-period", ex.period);
      setVal("cf-beginning", ex.beginning);
      ex.rows.forEach(function (r) { cfAddRow(r.type, r.amount); });
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
    document.querySelectorAll(".cf-example-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        applyCfExample(button.getAttribute("data-example"));
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateCashFlow()) return;
      var result = window.CashFlow.buildCashFlow({
        name: cfValue("cf-name"),
        period: cfValue("cf-period"),
        beginningCash: cfValue("cf-beginning"),
        transactions: cfCollectRows(),
      });
      if (result) {
        renderCashFlow(result);
      } else {
        if (document.getElementById("cf-transactions").querySelectorAll(".cf-row").length === 0) {
          cfAddRow();
        }
        var firstSel = document.querySelector("#cf-transactions .cf-row-select");
        if (firstSel) showError(firstSel, "Add at least one cash transaction to build a statement.");
      }
    });

    form.addEventListener("reset", function () {
      window.setTimeout(resetCashFlow, 0);
    });
  }
```

- [ ] **Step 2: Register in `DOMContentLoaded`** — add `initCashFlow();` after `initIncomeStatement();` and `resetCashFlow();` after `resetIncomeStatement();`.

- [ ] **Step 3: Run the full test suite**

Run: `node tests/cash-flow.test.js && node tests/income-statement.test.js && node tests/journal-entry.test.js && node tests/bank-reconciliation.test.js && node tests/depreciation.test.js`
Expected: all suites print "All N tests passed."

- [ ] **Step 4: Manual browser check** — open `index.html`; click each example (Healthy Month → net positive/green, all three sections populate, reconciliation adds up; Startup Launch → shows the financing-reliance insight; Equipment Upgrade → net negative/red, equipment tailored callout). Add a manual row, remove it, Reset. Confirm the other four tools still build.

- [ ] **Step 5: Commit**

```
git add index.html script.js styles.css
git commit -m "Wire up Cash Flow Helper behavior"
```

---

## Self-Review

**Spec coverage:** §2 locked decisions → Tasks 1–4; §3 catalog → Task 1 `CATALOG`; §4 inputs/validation → Task 2 markup + Task 4 `validateCashFlow`; §5 pure fn/view-model → Task 1; §6.1 cards → Task 4 summary + green/red via `cf-pos`/`cf-neg`; §6.2 statement + reconciliation + "None this period" → Task 2 markup + Task 4 `cfRenderSection`; §6.3 always-on examples (static) + tailored callouts → Task 2 static `<ul>` + Task 4 `cf-tailored`; §6.4 light insight (deduped) → Task 4 `cf-insight`; §7 files/wiring → all tasks; §8 tests → Task 1. All covered.

**Placeholder scan:** No TBD/TODO; every code step has full code. `cfSignedMoney` is defined but the render uses `formatMoney` directly (which already prints the leading "-" for negatives) — remove `cfSignedMoney` during implementation to avoid dead code (noted here so it isn't shipped).

**Type consistency:** `buildCashFlow` view-model property names (`operating.subtotal`, `netChange`, `isNetPositive`, `flags.*`) match between Task 1 and Task 4. Catalog ids used in `CF_EXAMPLES` and tests match `CATALOG`.
