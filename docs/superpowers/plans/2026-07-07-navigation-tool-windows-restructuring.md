# Navigation & Tool-Window Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the LedgerLab homepage, turn the six Key Concept cards into the primary calls to action, and move the five Accounting Tools into full-screen slim-inset tool-window overlays — with zero changes to any tool calculation, ID, or test.

**Architecture:** Structure + presentation only. Each tool's existing markup is wrapped in place inside a hidden `.tool-modal` overlay (all IDs preserved, so `init*()` wiring keeps working). New overlay open/close/focus-trap/scroll-lock code is added to `script.js`; new `.tool-modal*` and `.card*` rules are added to `styles.css`.

**Tech Stack:** Static HTML, CSS (existing dark palette), vanilla ES5-style JS. No libraries. Node built-in `assert` for the (unchanged) tests.

## Global Constraints

- Do NOT change any accounting formula, tool calculation, tool element ID, or any file in `tests/`.
- Do NOT touch `journal-entry.js`, `bank-reconciliation.js`, `depreciation.js`, `income-statement.js`, `cash-flow.js`.
- New homepage order: Hero → Our Mission (`#audience`) → Key Concepts (`#features`) → Business Simulator (`#simulator`) → Footer.
- Tool windows are full-screen slim-inset overlays (NOT small popups). Close via ✕, Escape, and backdrop click. Lock background scroll while open. Focus trap enabled. `role="dialog"` + `aria-modal="true"`. One open at a time. No URL/hash routing.
- Nav links become: Mission (`#audience`) · Key Concepts (`#features`) · Simulator (`#simulator`). Remove the "Tools" link.
- Keep the current LedgerLab dark theme.
- Overlay open keys: `journal`, `bankrec`, `depreciation`, `income`, `cashflow`.

---

### Task 1: Homepage reorder, Key Concept CTAs, and nav

**Files:**
- Modify: `index.html` — nav (`21-26`); remove `#features` from its current spot (`51-117`); remove `#get-started` (`174-189`); insert the rewritten `#features` after `#audience` (before the Simulator comment at `191`).

**Interfaces:**
- Produces: card buttons with `data-open-tool="income|cashflow|journal|bankrec|depreciation"` (consumed by Task 3 JS); a `<a href="#simulator" class="btn btn-primary card-cta">` (consumed by existing `initSmoothScroll`); classes `.card-cta`, `.card-badge` (styled in Task 3 CSS).

- [ ] **Step 1: Update the nav links** — replace:

```html
      <nav class="nav-links" aria-label="Primary">
        <a href="#features">Key Concepts</a>
        <a href="#audience">Mission</a>
        <a href="#simulator">Simulator</a>
        <a href="#tools">Tools</a>
      </nav>
```

with:

```html
      <nav class="nav-links" aria-label="Primary">
        <a href="#audience">Mission</a>
        <a href="#features">Key Concepts</a>
        <a href="#simulator">Simulator</a>
      </nav>
```

- [ ] **Step 2: Remove the old `#features` section** — delete the entire current Key Concepts section (from `<section id="features" class="section">` through its closing `</section>` at line 117). After this, the Hero is followed directly by the `<!-- ===== Built for Beginners... -->` comment and `#audience` (Mission), making Mission the first section after the hero.

- [ ] **Step 3: Remove the `#get-started` section** — delete:

```html
    <!-- ===== Get Started ===== -->
    <section id="get-started" class="section get-started">
      <div class="container">
        <div class="get-started-inner">
          <h2>Get Started</h2>
          <p class="get-started-lead">
            Begin by running a business scenario or explore the accounting process
            behind the numbers.
          </p>
          <div class="get-started-actions">
            <a href="#simulator" class="btn btn-primary">Start Business Simulator</a>
            <a href="#tools" class="btn btn-secondary">Explore the Accounting Process</a>
          </div>
        </div>
      </div>
    </section>

```

- [ ] **Step 4: Insert the rewritten `#features` after `#audience`** — immediately before the line `    <!-- ===== Business Simulator (MVP) ===== -->`, insert:

```html
    <!-- ===== Key Concepts ===== -->
    <section id="features" class="section">
      <div class="container">
        <header class="section-head">
          <h2>Key Concepts of Accounting Through LedgerLab</h2>
          <p class="section-sub">
            Six core areas of business accounting, each broken down into something
            you can practice hands-on.
          </p>
        </header>

        <div class="card-grid">
          <article class="card">
            <span class="card-badge">★ Recommended First</span>
            <div class="card-icon" aria-hidden="true">📊</div>
            <h3>Business Financing &amp; Assessment</h3>
            <p>
              Understand how money enters a business, how expenses affect performance,
              and how owners or managers assess financial health.
            </p>
            <a href="#simulator" class="btn btn-primary card-cta">Go to Business Simulator</a>
          </article>

          <article class="card">
            <div class="card-icon" aria-hidden="true">📑</div>
            <h3>Financial Statements</h3>
            <p>
              See how managers analyze a business through reports like the income
              statement, balance sheet, and cash flow statement.
            </p>
            <button type="button" class="btn btn-secondary card-cta" data-open-tool="income">
              Open Income Statement Builder
            </button>
          </article>

          <article class="card">
            <div class="card-icon" aria-hidden="true">💵</div>
            <h3>Cash Flows</h3>
            <p>
              Follow how cash moves in and out of a business and why profit and cash
              are not always the same.
            </p>
            <button type="button" class="btn btn-secondary card-cta" data-open-tool="cashflow">
              Learn &amp; Use Tool
            </button>
          </article>

          <article class="card">
            <div class="card-icon" aria-hidden="true">📒</div>
            <h3>Journal Entries</h3>
            <p>
              Learn how transactions enter a business's books through debits, credits,
              and balanced records.
            </p>
            <button type="button" class="btn btn-secondary card-cta" data-open-tool="journal">
              Learn &amp; Use Tool
            </button>
          </article>

          <article class="card">
            <div class="card-icon" aria-hidden="true">🏦</div>
            <h3>Bank Reconciliation</h3>
            <p>
              Compare book cash records to bank records and understand how businesses
              prove their cash balance is correct.
            </p>
            <button type="button" class="btn btn-secondary card-cta" data-open-tool="bankrec">
              Learn &amp; Use Tool
            </button>
          </article>

          <article class="card">
            <div class="card-icon" aria-hidden="true">📉</div>
            <h3>Depreciation Knowledge</h3>
            <p>
              Learn how long-term assets lose value over time and how that affects
              expenses, book value, and financial reports.
            </p>
            <button type="button" class="btn btn-secondary card-cta" data-open-tool="depreciation">
              Learn &amp; Use Tool
            </button>
          </article>
        </div>
      </div>
    </section>
```

- [ ] **Step 5: Sanity check + commit** — open `index.html`; confirm order is Hero → Mission → Key Concepts → Simulator → Footer, no Get Started, nav has three links. Buttons are inert until Task 3 (tools) + Task 4 (JS).

```
git add index.html
git commit -m "Reorder homepage, add Key Concept CTAs, update nav"
```

---

### Task 2: Wrap the five tools into `.tool-modal` overlays

**Files:**
- Modify: `index.html` — remove the `#tools` section chrome (`section`, `.container`, `.section-head`) and wrap each of the five existing tool blocks (`.je-tool`, `.br-tool`, `.dep-tool`, `.is-tool`, `.cf-tool`) verbatim inside a `.tool-modal` overlay. The tool markup itself is moved **unchanged**.

**Interfaces:**
- Produces: five overlays with ids `tool-modal-journal`, `tool-modal-bankrec`, `tool-modal-depreciation`, `tool-modal-income`, `tool-modal-cashflow`, each containing a `.tool-modal-close` button (consumed by Task 4 JS).

Overlay wrapper template (per tool). **Opening wrapper** goes immediately before the tool's `<div class="...-tool">`:

```html
    <!-- ===== Tool Window: TITLE ===== -->
    <div class="tool-modal" id="tool-modal-KEY" role="dialog" aria-modal="true"
         aria-labelledby="tool-modal-KEY-title" hidden>
      <div class="tool-modal-panel">
        <header class="tool-modal-header">
          <h2 class="tool-modal-title" id="tool-modal-KEY-title">TITLE</h2>
          <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
        </header>
        <div class="tool-modal-body">
          <div class="container">
```

**Closing wrapper** goes immediately after the tool block's closing `</div>`:

```html
          </div>
        </div>
      </div>
    </div>
```

KEY / TITLE / tool-block mapping (in existing source order):

| KEY | tool block opener | TITLE |
|---|---|---|
| `journal` | `<div class="je-tool">` | Journal Entry Helper |
| `bankrec` | `<div class="je-tool br-tool">` | Bank Reconciliation Helper |
| `depreciation` | `<div class="je-tool br-tool dep-tool">` | Depreciation Calculator |
| `income` | `<div class="je-tool br-tool is-tool">` | Income Statement Builder |
| `cashflow` | `<div class="je-tool br-tool cf-tool">` | Cash Flow Helper |

- [ ] **Step 1: Replace the `#tools` section opener + first tool opener** — replace:

```html
    <section id="tools" class="section section-alt">
      <div class="container">
        <header class="section-head">
          <h2>Accounting Tools</h2>
          <p class="section-sub">
            Hands-on tools for each accounting topic. First up: turn everyday
            business transactions into journal entries.
          </p>
        </header>

        <!-- ---- Journal Entry Helper ---- -->
        <div class="je-tool">
```

with:

```html
    <!-- ===== Tool Window: Journal Entry Helper ===== -->
    <div class="tool-modal" id="tool-modal-journal" role="dialog" aria-modal="true"
         aria-labelledby="tool-modal-journal-title" hidden>
      <div class="tool-modal-panel">
        <header class="tool-modal-header">
          <h2 class="tool-modal-title" id="tool-modal-journal-title">Journal Entry Helper</h2>
          <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
        </header>
        <div class="tool-modal-body">
          <div class="container">
        <!-- ---- Journal Entry Helper ---- -->
        <div class="je-tool">
```

- [ ] **Step 2: Wrap the four internal tool boundaries** — at each boundary between two tool blocks, the current text is the previous tool's closing `</div>` followed by the next tool's comment + opener. Replace each boundary by closing the previous overlay and opening the next. Find each boundary by its next-tool comment and replace:

Boundary 1 → 2 (before Bank Reconciliation): replace
```html
        <!-- ---- Bank Reconciliation Helper ---- -->
        <div class="je-tool br-tool">
```
with
```html
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tool Window: Bank Reconciliation Helper ===== -->
    <div class="tool-modal" id="tool-modal-bankrec" role="dialog" aria-modal="true"
         aria-labelledby="tool-modal-bankrec-title" hidden>
      <div class="tool-modal-panel">
        <header class="tool-modal-header">
          <h2 class="tool-modal-title" id="tool-modal-bankrec-title">Bank Reconciliation Helper</h2>
          <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
        </header>
        <div class="tool-modal-body">
          <div class="container">
        <!-- ---- Bank Reconciliation Helper ---- -->
        <div class="je-tool br-tool">
```

Boundary 2 → 3 (before Depreciation): replace
```html
        <!-- ---- Depreciation Calculator ---- -->
        <div class="je-tool br-tool dep-tool">
```
with
```html
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tool Window: Depreciation Calculator ===== -->
    <div class="tool-modal" id="tool-modal-depreciation" role="dialog" aria-modal="true"
         aria-labelledby="tool-modal-depreciation-title" hidden>
      <div class="tool-modal-panel">
        <header class="tool-modal-header">
          <h2 class="tool-modal-title" id="tool-modal-depreciation-title">Depreciation Calculator</h2>
          <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
        </header>
        <div class="tool-modal-body">
          <div class="container">
        <!-- ---- Depreciation Calculator ---- -->
        <div class="je-tool br-tool dep-tool">
```

Boundary 3 → 4 (before Income Statement): replace
```html
        <!-- ---- Income Statement Builder ---- -->
        <div class="je-tool br-tool is-tool">
```
with
```html
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tool Window: Income Statement Builder ===== -->
    <div class="tool-modal" id="tool-modal-income" role="dialog" aria-modal="true"
         aria-labelledby="tool-modal-income-title" hidden>
      <div class="tool-modal-panel">
        <header class="tool-modal-header">
          <h2 class="tool-modal-title" id="tool-modal-income-title">Income Statement Builder</h2>
          <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
        </header>
        <div class="tool-modal-body">
          <div class="container">
        <!-- ---- Income Statement Builder ---- -->
        <div class="je-tool br-tool is-tool">
```

Boundary 4 → 5 (before Cash Flow): replace
```html
        <!-- ---- Cash Flow Helper ---- -->
        <div class="je-tool br-tool cf-tool">
```
with
```html
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tool Window: Cash Flow Helper ===== -->
    <div class="tool-modal" id="tool-modal-cashflow" role="dialog" aria-modal="true"
         aria-labelledby="tool-modal-cashflow-title" hidden>
      <div class="tool-modal-panel">
        <header class="tool-modal-header">
          <h2 class="tool-modal-title" id="tool-modal-cashflow-title">Cash Flow Helper</h2>
          <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
        </header>
        <div class="tool-modal-body">
          <div class="container">
        <!-- ---- Cash Flow Helper ---- -->
        <div class="je-tool br-tool cf-tool">
```

- [ ] **Step 3: Close the last overlay + drop the section wrappers** — at the end of the Cash Flow block, the current text is the tool's closing `</div>`, then the `.container` close, then `</section>`, then `</main>`. Replace:

```html
        </div>
      </div>
    </section>
  </main>
```

with (close the cf tool block + the four overlay wrappers, then `</main>`):

```html
          </div>
        </div>
      </div>
    </div>
  </main>
```

> Note: the cf-tool block's own final `</div>` (`        </div>` at the current end) is the tool block close; the replacement above provides the four overlay-closing lines (`.container`, `.tool-modal-body`, `.tool-modal-panel`, `.tool-modal`) and the `</main>`. During execution, verify indentation matches the surrounding file before applying.

- [ ] **Step 4: Verify structure + commit** — open `index.html`; the five tools no longer appear in the page flow (they are `hidden` overlays). Run `node --check`-equivalent by loading the page: no visible tools between Simulator and Footer. Confirm no leftover `id="tools"` / `id="get-started"` / `href="#tools"` remain (grep).

```
git add index.html
git commit -m "Move Accounting Tools into full-screen tool-window overlays"
```

---

### Task 3: Tool-window + card CSS

**Files:**
- Modify: `styles.css` — append new rules at end of file; update `.card p` margin and `.card` display in the card block (`308-349`).

**Interfaces:**
- Consumes: existing palette vars (`--bg`, `--surface`, `--surface-2`, `--surface-hover`, `--border`, `--border-strong`, `--text`, `--text-soft`, `--radius`, `--shadow-md`).
- Produces: `.tool-modal`, `.tool-modal[hidden]`, `.tool-modal-panel`, `.tool-modal-header`, `.tool-modal-title`, `.tool-modal-close`, `.tool-modal-body`, `body.modal-open`, `.card-cta`, `.card-badge`.

- [ ] **Step 1: Make cards flex columns with a pinned CTA** — replace:

```css
.card p {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.97rem;
}
```

with:

```css
.card {
  display: flex;
  flex-direction: column;
}

.card p {
  margin: 0 0 1.25rem;
  color: var(--text-soft);
  font-size: 0.97rem;
}

.card-cta {
  margin-top: auto;
  align-self: flex-start;
}

.card-badge {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fbbf24;
  background: rgba(250, 204, 21, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.35);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}
```

> `.card` is already `position: relative` (line 309), so the absolute badge anchors to the card.

- [ ] **Step 2: Append tool-window styles** at the end of `styles.css`:

```css
/* ---- Tool Windows (full-screen slim-inset overlays) ---- */
.tool-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  padding: clamp(0.5rem, 2vh, 1.25rem);
  background: rgba(5, 10, 20, 0.78);
}
.tool-modal[hidden] { display: none; }

.tool-modal-panel {
  position: relative;
  flex: 1 1 auto;
  max-width: 1400px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.tool-modal-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.tool-modal-title { margin: 0; font-size: 1.15rem; color: var(--text); }

.tool-modal-close {
  flex: 0 0 auto;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}
.tool-modal-close:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.tool-modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 1.5rem 0;
}

body.modal-open { overflow: hidden; }
```

- [ ] **Step 3: Sanity check + commit** — reload; cards show aligned buttons + the badge on the first card. Overlays remain hidden (no JS yet).

```
git add styles.css
git commit -m "Add tool-window and Key Concept card styles"
```

---

### Task 4: Overlay behavior in `script.js`

**Files:**
- Modify: `script.js` — add `initToolWindows()` before the `DOMContentLoaded` handler; call it inside `DOMContentLoaded` after `initCashFlow()`.

**Interfaces:**
- Consumes: `.tool-modal` overlays + `[data-open-tool]` buttons (Tasks 1–2); `.tool-modal-close` buttons.
- Produces: `initToolWindows()`.

- [ ] **Step 1: Add the module** — insert immediately before `  document.addEventListener("DOMContentLoaded", function () {`:

```js
  /* ==========================================================
     Tool Windows (full-screen overlays)
     Show/hide each tool's existing DOM inside a .tool-modal.
     No tool logic changes here; tools are wired at page load.
     ========================================================== */
  function initToolWindows() {
    var modals = document.querySelectorAll(".tool-modal");
    if (!modals.length) return;

    var activeModal = null;
    var lastTrigger = null;
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),' +
      ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function visibleFocusables(modal) {
      return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE))
        .filter(function (el) { return el.offsetParent !== null; });
    }

    function openTool(key, trigger) {
      var modal = document.getElementById("tool-modal-" + key);
      if (!modal) return;
      lastTrigger = trigger || null;
      modal.hidden = false;
      activeModal = modal;
      document.body.classList.add("modal-open");
      var closeBtn = modal.querySelector(".tool-modal-close");
      if (closeBtn) closeBtn.focus();
    }

    function closeTool() {
      if (!activeModal) return;
      activeModal.hidden = true;
      activeModal = null;
      document.body.classList.remove("modal-open");
      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
      lastTrigger = null;
    }

    document.querySelectorAll("[data-open-tool]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openTool(btn.getAttribute("data-open-tool"), btn);
      });
    });

    modals.forEach(function (modal) {
      // Backdrop click (the .tool-modal itself, not the panel) closes.
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeTool();
      });
      var closeBtn = modal.querySelector(".tool-modal-close");
      if (closeBtn) closeBtn.addEventListener("click", closeTool);
    });

    document.addEventListener("keydown", function (event) {
      if (!activeModal) return;
      if (event.key === "Escape") { event.preventDefault(); closeTool(); return; }
      if (event.key === "Tab") {
        var items = visibleFocusables(activeModal);
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });
  }
```

- [ ] **Step 2: Register in `DOMContentLoaded`** — after `initCashFlow();`, add `initToolWindows();` (no reset call needed — overlays start hidden via the `hidden` attribute).

- [ ] **Step 3: Syntax check**

Run: `node --check script.js`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```
git add script.js
git commit -m "Add tool-window open/close, Escape, backdrop, focus trap, scroll lock"
```

---

### Task 5: Verification

**Files:** none (verification only).

- [ ] **Step 1: Run every existing unit suite** (must be unchanged and green)

Run:
```
node tests/journal-entry.test.js && node tests/bank-reconciliation.test.js && node tests/depreciation.test.js && node tests/income-statement.test.js && node tests/cash-flow.test.js
```
Expected: each prints "All N tests passed." (8, 10, 8, 15, 10 → 51 total).

- [ ] **Step 2: Confirm no dead references remain**

Run (grep): no matches for `href="#tools"`, `id="tools"`, `id="get-started"`.

- [ ] **Step 3: Manual browser pass** (open `index.html`):
  - Order is Hero → Mission → Key Concepts → Simulator → Footer; no Get Started; no stacked tools.
  - Each of the five card buttons opens the correct tool window (title in header matches).
  - "Go to Business Simulator" smooth-scrolls to the Simulator; no window opens.
  - Each window closes via ✕, Escape, and backdrop click; focus returns to the card button.
  - Background does not scroll while open; the tool body scrolls internally when long.
  - Build a result in each tool inside its window (e.g. an example button) — calculations still work.
  - Nav links scroll to Mission / Key Concepts / Simulator; no "Tools" link.

- [ ] **Step 4: Report** — files changed, tests + results, manual checks performed, `git status`.

---

## Self-Review

**Spec coverage:** §2 order → Task 1; Get Started removal → Task 1 Step 3; `#tools` removal + verbatim move → Task 2; tool-window style/behavior (✕/Esc/backdrop/scroll-lock/focus-trap/aria/one-at-a-time/no-routing) → Task 2 markup + Task 3 CSS + Task 4 JS; card CTAs + badge + Simulator smooth-scroll → Task 1 + Task 3; nav → Task 1 Step 1; overlay DOM location → Task 2 (wrapped in place at the former `#tools` location; functionally identical to "after footer" since `position: fixed`); untouched logic/tests → Global Constraints + Task 5. All covered.

**Placeholder scan:** No TBD/TODO. Verbatim tool markup is *moved, not retyped* (Task 2 wraps existing blocks at their boundaries), which is why full tool bodies are not re-pasted — this is a move, not new code.

**Type/naming consistency:** overlay ids `tool-modal-<key>` and `data-open-tool="<key>"` use the same five keys (`journal`, `bankrec`, `depreciation`, `income`, `cashflow`) in Tasks 1, 2, and 4. `openTool(key)` builds `"tool-modal-" + key` — matches the ids. `.tool-modal-close`, `.card-cta`, `.card-badge`, `body.modal-open` match across HTML/CSS/JS.
