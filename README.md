# Pathwise

[![CI](https://github.com/<your-username>/pathwise/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-username>/pathwise/actions/workflows/ci.yml)

**Plot the decision. Don't guess it.**

A decision instrument for the forks in the road that don't have a clean right answer — grad school vs. a job, a startup vs. stability, bootcamp vs. self-taught. Built for **USAII's Global AI Hackathon 2026**, Undergraduate Track, **Challenge 3: Build the "Second Brain" for Real Life** (Direction A — Life Decision Simulator).

🔗 **Live demo:** _add your deployed URL here after publishing_
🎥 **Pitch video:** _add your video link here_

---

## The problem we're actually solving

Most "decision help" tools fail in one of two predictable ways. A pros/cons list oversimplifies — it treats every consideration as equally weighted and ignores that tradeoffs change over time. A wall of research overwhelms — it hands you forty browser tabs and calls that "informed."

Neither one helps you *reason*. Pathwise tries to sit in the gap: it models two real paths across four lenses (financial, growth, stability, personal fit) at three time horizons (1 year, 3 years, 10 years), shows you exactly how confident it is about each number, and surfaces the tradeoffs a static list would never think to mention — without ever pretending to hand you a correct answer.

## What it actually does

1. **Pick two real paths** — grad school, a full-time job, a startup, or a bootcamp/self-taught route — and tune the numbers to match your actual situation (program cost, runway, starting salary, whatever applies).
2. **Weigh what matters to you** right now across the four lenses. The weights shape a computed *lean*, not a verdict.
3. **Read the chart.** Each path is a line plotted across three time gates. Faded nodes mean lower model confidence — that's not a cosmetic choice, it changes how plainly the model is willing to talk about that number.
4. **See what a list would've missed.** Hidden considerations are generated from the *combination* of your two paths and your stated context (dependents, location flexibility, runway), not from either path in isolation.
5. **Run a "what if."** Toggle realistic variations — more funding, less runway, a raise, a co-founder — and watch the chart actually move.
6. **Read the plain-language take**, either from a built-in template narrator (zero cost, zero setup) or, optionally, a live Claude API call if you provide a key.

Nowhere does the app tell you what to do. It computes a `lean`, never a `decision` — that's enforced in code, not just claimed in a slide (see `engine.js`, `enforceAdvisoryFraming()`).

## Why this needed AI — and where it stops

This is the question judges are told to ask explicitly, so here's the direct answer.

**Layer 1 — deterministic rules engine (`engine.js`).** All actual tradeoff scoring happens here, in plain auditable JavaScript. No LLM touches the numbers. This matters because tradeoff scoring needs to be *repeatable*: if you run the same comparison twice, you should get the same structural reasoning both times. An LLM is probabilistic by nature and would silently drift between runs — which is exactly the "false confidence in uncertain outcomes" failure mode the brief explicitly warns against. So the part of the system that most resembles "real reasoning" — modeling four lenses across three horizons with honest confidence bands — is intentionally *not* the LLM.

**Layer 2 — optional LLM narration (`llm.js`).** What a rules engine genuinely cannot do is read "my parents really want me to play it safe" out of a free-text box and adjust its tone and emphasis accordingly. That's a real natural-language understanding task, and it's the one place in this system where an LLM earns its keep. Critically, the prompt sent to the model explicitly instructs it not to invent or override the computed scores — it only explains them. If no API key is provided, a template-based fallback narrator produces a comparably useful (if less personalized) explanation, so the entire app — including this layer — works with zero cost and zero setup for judges to try.

**Why not just automate the decision entirely?** Because the brief is right that this would be actively harmful. A 22-year-old's actual risk tolerance, family situation, and what they personally recover from well are not knowable from four numbers. That's the one decision this system is built to *never* make — see Human-in-the-Loop below.

## Responsible AI

**Risk.** The most realistic risk here is **false confidence in genuinely uncertain outcomes** — presenting a 10-year financial projection with the same apparent authority as a well-documented 1-year cost. A close second is **over-reliance**: a stressed-out student treating a computed "lean" as if it were a verdict.

**Mitigation.** Every single score in the system carries an explicit confidence level (`high` / `medium` / `low`), shown visually as node opacity in the chart and referenced directly in the generated language. Low-confidence claims are hedged in the copy on purpose (see the `fit` lens for grad school, which is deliberately scored with low confidence across all three horizons — fit is the thing this model can least reliably predict, and it says so). The weighted "lean" always displays the runner-up path's strongest dimension alongside the lean direction, so the losing option is never silently erased. The startup path's 3yr/10yr financial note explicitly states that those numbers are *conditional on survival*, not an expected value — because averaging a bimodal outcome into one number would itself be a form of false precision.

**Human-in-the-loop.** The one decision this system will never make: **which path to actually choose.** The engine computes a `lean` field and is structurally prevented from outputting anything resembling `decision`, `recommendation`, or `correctChoice` — `enforceAdvisoryFraming()` in `engine.js` deletes any such key before a result is ever returned, and every result ships with an explicit disclaimer. The reason a human has to stay in the loop here isn't procedural — it's that this decision involves private information (real risk tolerance under pressure, family obligations, what recovery from a setback actually looks like for a specific person) that this model never has access to and was never designed to guess at.

## Architecture (for the Devpost "AI Architecture Explanation" field)

| Stage | What happens |
|---|---|
| **Inputs** | Two chosen paths, user-edited numeric parameters (cost, runway, salary, etc.), four priority weights (1–10 each), optional free-text context, optional dependents/location flags |
| **AI capability** | (1) Decision-support / reasoning-chain scoring across a 4×3 tradeoff matrix — rules-based, not generative. (2) Optional generative NLP narration layer for plain-language explanation. (3) Lightweight scenario simulation via the what-if deltas. |
| **Processing** | Rules engine computes per-lens, per-horizon scores with confidence bands → weighted lean computed from user priority weights → hidden-consideration rules fire based on the *combination* of chosen paths and context → (optional) structured scores are handed to an LLM purely for language generation |
| **Outputs** | A two-path comparison chart across 4 lenses × 3 horizons, a weighted lean (never a verdict), a list of hidden considerations, a plain-language narrative, and what-if scenario deltas |

## Data disclosure

All numbers (default salaries, program costs, growth rates) are **synthetic, reasonable placeholders** calibrated loosely to Indian undergrad/early-career contexts (₹ figures), meant to be edited by the user to match their real situation — they are explicitly not sourced from any single dataset and the app does not claim they are. No real user data is collected or stored; the app runs fully client-side with no backend.

## Tools used

- Vanilla HTML/CSS/JavaScript — no build step, no framework, no dependencies
- **Free tier:** the entire app, including the rules engine and the template narrator, requires zero paid tools and zero API keys
- **Optional paid tier:** the live narration layer can call the Anthropic Claude API (`claude-sonnet-4-6`) if a user supplies their own key — this is opt-in and clearly labeled in the UI, never required
- Built with AI coding assistance (Claude) — disclosed per hackathon transparency requirements

## Running it locally

No build step. No install. Just open the file:

```bash
git clone https://github.com/<your-username>/pathwise.git
cd pathwise
open index.html        # macOS
# or: xdg-open index.html   (Linux)
# or: start index.html      (Windows)
```

Or serve it (recommended, avoids any local file:// quirks):

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Pushing to GitHub

This folder is already a git repo with an initial commit on `main`. To push it to your own GitHub:

```bash
cd pathwise
git remote add origin https://github.com/<your-username>/pathwise.git
git push -u origin main
```

If you'd rather start fresh, delete the `.git` folder first and re-init:

```bash
rm -rf .git
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<your-username>/pathwise.git
git push -u origin main
```

Once pushed, the CI workflow in `.github/workflows/ci.yml` runs automatically on every push and pull request — it syntax-checks all three JS files, sweeps every path combination for `NaN`/`null` regressions, and verifies the human-in-the-loop guardrail can't be bypassed. Update the badge URL at the top of this README with your actual username after pushing.

## Deploying

This is a static site — three files, zero dependencies. It deploys anywhere static hosting works.

**Netlify (drag-and-drop):** go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the project folder in. Done.

**Netlify (CLI):**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**GitHub Pages:** push to a repo, then in Settings → Pages, set the source to your `main` branch root. No build command needed.

## Project structure

```
pathwise/
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # syntax checks + full path-combination sweep + guardrail check
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── index.html       # markup + design tokens (CSS) — the "instrument panel"
├── engine.js          # deterministic rules engine — all tradeoff scoring lives here
├── llm.js             # optional LLM narration layer + template fallback
├── README.md
├── CONTRIBUTING.md    # explains the rules-engine vs narrative-layer split for contributors
├── CHANGELOG.md
├── LICENSE
├── netlify.toml
├── vercel.json
├── .gitignore
└── docs/
    ├── PITCH.md                  # elevator pitch + extended pitch script for the video
    └── DEVPOST_SUBMISSION.md     # pre-written answers for every required Devpost field
```

## Honest limitations

This is a hackathon MVP, not a financial planning tool. The path library currently covers four common routes (grad school, full-time job, startup, bootcamp) with synthetic, editable defaults — it does not pull live labor-market data, and it should not be the only input into an actual decision. It is, deliberately, a structured starting point for your own thinking — not a replacement for it.

## License

MIT — see `LICENSE`.

---

Built for USAII's Global AI Hackathon 2026 · Undergraduate Track · Challenge 3
