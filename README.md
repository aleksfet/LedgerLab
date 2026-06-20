# LedgerLab

**Learn accounting by running the numbers of a business.**

LedgerLab is an interactive accounting and business finance toolkit aimed at
beginners, accounting students, and new business owners. It's designed to make
accounting click by letting you work through real numbers — business expenses,
journal entries, bank reconciliations, depreciation, cash flow, and full
financial statements — instead of just reading definitions.

This repository currently contains the **starter landing page**. The interactive
simulator and calculators are placeholders for now and will be built next.

---

## What's in this starter

- A polished, responsive homepage / landing page
- Hero section with the title, subtitle, description, and two main buttons:
  - **Start Business Simulator**
  - **Explore Accounting Tools**
- A **"What LedgerLab Helps With"** section with cards for:
  - Business Budgeting
  - Journal Entries
  - Bank Reconciliation
  - Depreciation
  - Cash Flow
  - Financial Statements
- A **"Built for Beginners and Accounting Students"** section explaining that
  each tool shows both a plain-English explanation and an accounting-style output
- Placeholder sections for the **Business Simulator** and **Accounting Tools**
  that the main buttons scroll to

> The buttons currently just scroll to placeholder sections. No calculators or
> accounting logic have been built yet — that's intentional for this starter.

---

## Tech

Built with plain web fundamentals only — no frameworks, no build step, no
backend, no external libraries:

- **HTML** (`index.html`)
- **CSS** (`styles.css`)
- **JavaScript** (`script.js`)

---

## Files

| File          | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `index.html`  | Page structure and content                           |
| `styles.css`  | Styling, layout, and responsive design               |
| `script.js`   | Smooth-scroll behavior and active-nav highlighting   |
| `README.md`   | This file                                            |

---

## Run it locally

Because this is just static HTML/CSS/JS, you have two easy options.

### Option 1 — Open the file directly

Double-click `index.html`, or open it in your browser. That's it.

### Option 2 — Run a local server (recommended)

A local server avoids any browser quirks and matches how the site would be
served for real. From the project folder, run **one** of these:

**Python 3:**

```bash
py -3.13 -m http.server 8003
```

(or `python -m http.server 8003` depending on your setup)

Then open: <http://localhost:8003>

**Node (if you have it):**

```bash
npx serve .
```

Then open the URL it prints in the terminal.

---

## Roadmap (next steps)

- Build the interactive **Business Simulator**
- Add focused **calculators / worksheets** for each accounting topic
- Pair every tool with a plain-English explanation and an accounting-style output

---

_A learning project — for education, not professional financial advice._
