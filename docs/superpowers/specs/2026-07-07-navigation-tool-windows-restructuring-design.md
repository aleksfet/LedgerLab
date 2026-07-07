# Navigation & Tool-Window Restructuring — Design Spec

**Date:** 2026-07-07
**Status:** Approved (brainstorming complete)
**Scope:** LedgerLab homepage restructuring. Reorder sections, turn the six Key Concept cards into
the primary calls to action, and move the five Accounting Tools out of a stacked homepage section
into full-screen tool-window overlays. No accounting logic changes.

---

## 1. Goal

The five Accounting Tools should no longer sit stacked one after another on the homepage. Instead:

- The homepage becomes a short, scannable flow ending at the Business Simulator.
- The **Key Concepts** cards become the main navigation into each tool (and into the Simulator).
- Each Accounting Tool opens in a **large full-screen tool window** (slim-inset overlay), preserving
  the tool's current full layout, calculations, and wiring.

This is a structure + presentation change only. The Business Simulator stays directly on the page.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| New homepage order | Hero → Our Mission → Key Concepts → Business Simulator → Footer |
| Get Started section | **Removed entirely** (its role is served by the concept-card buttons + the on-page Simulator) |
| Stacked `#tools` section | **Removed** from the homepage flow; its five tools move verbatim into overlays |
| Tool window style | **Full-screen, slim inset** — near-full-viewport dark panel with ~1rem inset; dimmed backdrop peeks at the edges |
| Tool window is NOT | a small popup dialog |
| Close affordances | ✕/Close button **and** Escape key **and** backdrop click |
| Background scroll | **Locked** while a tool window is open (`body.modal-open { overflow: hidden }`) |
| Internal scroll | The tool body scrolls inside the panel when the tool is long |
| Accessibility | `role="dialog"` + `aria-modal="true"`; focus moves into the panel on open, restores to trigger on close; **focus trap** keeps Tab within the open panel |
| One-at-a-time | Only one tool window open at a time |
| URL / hash routing | **None for v1** — opening a tool does not change the address bar |
| Overlay DOM location | After the footer (they are `position: fixed`, so location does not affect layout) |
| Nav links | **Mission · Key Concepts · Simulator** (the "Tools" link is removed) |
| Design language | Keep the current LedgerLab dark theme |
| Calculations / tool IDs / tests | **Unchanged** |

**Out of scope for v1:** hash/deep-link routing, switching directly between tools without closing,
per-tool URLs, animation polish beyond a simple fade, changing any tool's internal markup or logic,
new unit tests (no logic changes).

---

## 3. Approach — wrap in place, do not rebuild

Every tool's behavior binds to element IDs at page load (`je-form`, `br-form`, `dep-form`,
`is-form`, `cf-form`, and their children) via the `init*()` functions in `script.js`. Therefore:

- **Relocate each existing tool block's markup, unchanged, into a hidden overlay container.** All IDs
  and classes are preserved, so every `init*()`/`reset*()` function and all five pure-logic modules
  (`journal-entry.js`, `bank-reconciliation.js`, `depreciation.js`, `income-statement.js`,
  `cash-flow.js`) keep working with **zero edits**.
- Only **add** overlay open/close plumbing around the tools, plus card buttons and the reorder.

Rejected alternatives: re-rendering tools on demand (risks breaking wiring for no benefit); splitting
tools into separate HTML pages (large change, loses the single-page feel).

---

## 4. Homepage reorder (`index.html`)

Target section order inside `<main>`:

1. `section.hero` — unchanged content.
2. `#audience` — **Our Mission** (moved **above** Key Concepts).
3. `#features` — **Key Concepts of Accounting Through LedgerLab** (cards gain buttons + one badge).
4. `#simulator` — **Business Simulator** — unchanged.
5. Footer — unchanged.

Removals:

- Delete the entire `#get-started` section.
- Remove the entire stacked `#tools` section (its header + the five tool blocks). The five tool
  blocks are **moved** (not deleted) into the overlay containers in section 6.

Navigation (`header .nav-links`):

- Final links, in order: `Mission (#audience)` · `Key Concepts (#features)` · `Simulator (#simulator)`.
- Remove the `Tools (#tools)` link.
- The hero's existing "Learn the Key Concepts" button (`#features`) remains valid.

---

## 5. Key Concept cards (`#features`)

Each of the six `article.card` elements gains a call-to-action button at the bottom. The card becomes
a vertical flex column so buttons align across the grid. One card also gains a badge.

| Card | Badge | Button label | Action |
|---|---|---|---|
| Business Financing & Assessment | `★ Recommended First` | **Go to Business Simulator** | Smooth-scroll to `#simulator` (reuse existing smooth-scroll) — a normal `<a href="#simulator">` styled as a primary button |
| Financial Statements | — | **Open Income Statement Builder** | Open the `income` tool window |
| Cash Flows | — | **Learn & Use Tool** | Open the `cashflow` tool window |
| Journal Entries | — | **Learn & Use Tool** | Open the `journal` tool window |
| Bank Reconciliation | — | **Learn & Use Tool** | Open the `bankrec` tool window |
| Depreciation Knowledge | — | **Learn & Use Tool** | Open the `depreciation` tool window |

- Tool buttons are `<button type="button" class="btn btn-secondary card-cta" data-open-tool="KEY">`
  where `KEY` ∈ `{ income, cashflow, journal, bankrec, depreciation }`.
- The Simulator card's button is a smooth-scroll anchor (primary style), **not** a tool window.
- The badge is a small `.card-badge` element (`★ Recommended First`) on the first card.

---

## 6. Tool windows (overlays)

Five overlay containers, one per tool, placed after `</footer>` (before the script tags). Each loads
`hidden`. Markup shape (Income Statement shown; the other four are identical with their own key,
id, and title):

```html
<div class="tool-modal" id="tool-modal-income" role="dialog" aria-modal="true"
     aria-labelledby="tool-modal-income-title" hidden>
  <div class="tool-modal-panel">
    <header class="tool-modal-header">
      <h2 class="tool-modal-title" id="tool-modal-income-title">Income Statement Builder</h2>
      <button type="button" class="tool-modal-close" aria-label="Close tool">✕</button>
    </header>
    <div class="tool-modal-body">
      <div class="container">
        <!-- existing tool block markup, moved verbatim and unchanged -->
      </div>
    </div>
  </div>
</div>
```

Overlay key → tool block → title:

| Key | Tool block moved in | Window title |
|---|---|---|
| `journal` | Journal Entry Helper (`.je-tool`) | Journal Entry Helper |
| `bankrec` | Bank Reconciliation Helper (`.br-tool`) | Bank Reconciliation Helper |
| `depreciation` | Depreciation Calculator (`.dep-tool`) | Depreciation Calculator |
| `income` | Income Statement Builder (`.is-tool`) | Income Statement Builder |
| `cashflow` | Cash Flow Helper (`.cf-tool`) | Cash Flow Helper |

Notes:

- The tool's own existing intro (`tool-title`, `tool-sub`, `dep-intro`, etc.) stays inside the body —
  the current full layout is preserved. The overlay header adds the sticky title bar + Close control.
- The `.container` wrapper inside `.tool-modal-body` preserves the tool's existing max-width/centering.
- `.tool-modal-panel` is a flex column: the header is sticky/fixed at the top; `.tool-modal-body`
  is the scroll region (`overflow-y: auto`).

---

## 7. Overlay behavior (`script.js` — new code only)

New self-contained module, wired in `DOMContentLoaded` after the existing `init*()` calls. Adds no
changes to any existing tool function.

State: `activeModal` (the open `.tool-modal` element, or null) and `lastTrigger` (the button/anchor
that opened it, for focus restoration).

- **Open** — a single delegated `click` listener on `[data-open-tool]`:
  1. Resolve `KEY` → `#tool-modal-<KEY>`.
  2. Set `lastTrigger = event.currentTarget`; store and unhide the modal (`hidden = false`).
  3. Add `modal-open` class to `<body>` (locks background scroll).
  4. Move focus to the modal's close button (or first focusable element in the panel).
- **Close** — `closeTool()` triggered by: the `.tool-modal-close` button, `Escape` keydown (when a
  modal is open), or a click on the `.tool-modal` backdrop **outside** `.tool-modal-panel`:
  1. Hide the modal (`hidden = true`); clear `activeModal`.
  2. Remove `modal-open` from `<body>` (restores scroll).
  3. Restore focus to `lastTrigger`.
- **Focus trap** — while a modal is open, `Tab`/`Shift+Tab` cycles only through focusable elements
  inside `.tool-modal-panel` (wraps at both ends).
- **One-at-a-time** — opening is only reachable from the homepage (no cross-tool switching); at most
  one modal is ever open.
- **Backdrop vs. panel** — clicks are closed only when the click target is the `.tool-modal` element
  itself (the backdrop), not a descendant of `.tool-modal-panel`.

Existing `resetSimulatorState`/`reset*` on `DOMContentLoaded` and `pageshow` are unaffected. Tools do
not need re-initialization on open because their DOM (and wiring) exists from page load.

---

## 8. Styling (`styles.css` — additive only)

New rules, all in the existing dark palette; no changes to existing tool styles.

- `.tool-modal` — `position: fixed; inset: 0; z-index` above the header; dimmed backdrop
  (`background: rgba(...)`); `display: flex` centering; slim inset padding (~`clamp(0.5rem, 2vh, 1.25rem)`);
  hidden honored via the `hidden` attribute.
- `.tool-modal-panel` — near-full width/height within the inset; dark `--surface` background; border;
  `border-radius`; `display: flex; flex-direction: column; overflow: hidden`; max-width guard so it
  never exceeds a sensible reading width on very wide screens while still filling most of the viewport.
- `.tool-modal-header` — sticky top bar: flex row, space-between, padding, `border-bottom`; holds
  `.tool-modal-title` and `.tool-modal-close`.
- `.tool-modal-close` — icon button styling consistent with existing controls; visible hover/focus.
- `.tool-modal-body` — `flex: 1; overflow-y: auto`; padding; contains the `.container` + tool markup.
- `body.modal-open { overflow: hidden; }` — background scroll lock.
- `.card` — becomes `display: flex; flex-direction: column`; text grows, button pinned at the bottom
  (`margin-top: auto`) so CTAs align across the grid.
- `.card-cta` — full-width-ish button spacing within the card.
- `.card-badge` — small pill (`★ Recommended First`) using an accent color from the existing palette.

Responsive: on small screens the panel effectively fills the viewport (inset shrinks); the two-panel
tool layouts already stack via existing tool CSS.

---

## 9. Files touched

| File | Change |
|---|---|
| `index.html` | Reorder sections (Mission above Key Concepts); delete `#get-started`; remove the `#tools` section wrapper; move the five tool blocks verbatim into five `.tool-modal` overlays after the footer; add card buttons + badge; update nav links |
| `styles.css` | Add `.tool-modal*`, `body.modal-open`, `.card`/`.card-cta`/`.card-badge` rules (additive) |
| `script.js` | Add the overlay open/close/focus-trap module; wire it in `DOMContentLoaded`; remove the now-dead `#tools` nav behavior only if any exists (active-nav uses section ids — verify `#tools`/`#get-started` are not referenced) |

**Not touched:** `journal-entry.js`, `bank-reconciliation.js`, `depreciation.js`,
`income-statement.js`, `cash-flow.js`, and all files in `tests/`.

---

## 10. Verification

- **Automated:** the existing 51 unit tests still pass (no logic touched) — run all five
  `node tests/*.test.js` suites.
- **Manual browser pass:**
  - New homepage order renders: Hero → Mission → Key Concepts → Simulator → Footer; no Get Started,
    no stacked tools.
  - Each of the five tool buttons opens the correct full-screen tool window.
  - "Go to Business Simulator" smooth-scrolls to the Simulator (no window opens).
  - Each window closes via ✕, Escape, and backdrop click, returning to the homepage scroll position.
  - Background does not scroll while a window is open; the tool body scrolls internally when long.
  - Focus moves into the window on open and returns to the triggering card button on close; Tab stays
    trapped inside the open window.
  - Every tool still calculates correctly inside its window (build a statement in each).
  - Nav links (Mission, Key Concepts, Simulator) scroll to the right sections; no "Tools" link.

---

## 11. Non-goals recap

No accounting-logic or tool-ID changes. No new tools. No hash routing, no cross-tool switching, no
per-tool pages. Keep the dark theme. The change is limited to homepage structure, the concept-card
calls to action, and the tool-window overlay mechanism.
