# Contributing to Pathwise

Thanks for taking a look. This is a hackathon project (USAII Global AI Hackathon 2026), so the bar here is "clear and correct," not "enterprise-grade" — but a few things matter a lot for this specific project.

## Before you touch anything, understand the split

This app has two deliberately separate layers, and almost every contribution falls cleanly into one of them:

- **`engine.js`** — the rules engine. All actual tradeoff scoring happens here, deterministically. No LLM calls, no randomness, no `Math.random()`. If you're adding a new path type, a new lens, or a new what-if scenario, you're working here.
- **`llm.js`** — the narrative layer. This turns the engine's structured output into plain language, either via an optional Claude API call or a template fallback. It should never compute new scores or override the engine's numbers — it only explains them.

If you're not sure which layer a change belongs in, ask: "does this change a number, or does this change how a number is described?" Numbers → `engine.js`. Description → `llm.js`.

## The one rule that can't be broken

`engine.js` has a function called `enforceAdvisoryFraming()` that strips any field resembling a verdict (`decision`, `recommendation`, `correctChoice`, `answer`) from every result before it's returned. This is the human-in-the-loop guardrail described in the README and the Devpost submission. **Don't add a code path that bypasses this function**, and don't add a new field to a result object that would need it to fire. The app should never tell anyone what to choose — it computes a `lean`, never a verdict.

## Adding a new path type

1. Add an entry to `PATH_LIBRARY` in `engine.js` with `id`, `label`, `shortLabel`, `description`, `defaultParams`, and a `score(params, ctx)` function.
2. Every lens (`financial`, `growth`, `stability`, `fit`) needs a value for all three horizons (`1yr`, `3yr`, `10yr`), a `confidence` object with a level for each horizon, and a `note` string.
3. Be honest about confidence. If you genuinely can't predict something 10 years out, mark it `low` — don't round up to `medium` to make the chart look more complete.
4. Add the path's editable parameters to `PARAM_FIELDS` in `app.js` so the UI can render input controls for it.
5. Optionally add what-if deltas to `WHATIF_OPTIONS` in `app.js` and the corresponding `deltas` object in `applyWhatIf()` in `engine.js`.
6. Run the full combination sweep (see `.github/workflows/ci.yml` or just run the equivalent `node -e` snippet locally) to confirm no `NaN`/`null` leaks across every pairing with the new path.

## Adding a new hidden consideration

Hidden considerations live in `getHiddenConsiderations()` in `engine.js`. The whole point of this function is that considerations should emerge from the **combination** of two paths and the user's context — not just describe one path in isolation (that's what the per-lens `note` fields are for). Before adding one, ask: would a static pros/cons list for either path alone have caught this? If yes, it doesn't belong here.

## Testing locally

There's no test framework dependency baked into the repo (keeping it zero-install), but here's the quick sweep used in CI:

```bash
node --check engine.js && node --check llm.js && node --check app.js

node -e "
const Engine = require('./engine.js');
const ids = Object.keys(Engine.PATH_LIBRARY);
for (const a of ids) for (const b of ids) {
  if (a === b) continue;
  const r = Engine.compare({
    pathAId: a, pathBId: b,
    paramsA: Engine.PATH_LIBRARY[a].defaultParams,
    paramsB: Engine.PATH_LIBRARY[b].defaultParams,
    ctx: { hasDependents: false, locationFlex: true },
    weights: { financial: 5, growth: 5, stability: 5, fit: 5 }
  });
  if (JSON.stringify(r).includes('NaN')) console.log('BUG:', a, b);
}
console.log('done');
"
```

Then open `index.html` in a browser and manually click through: pick two paths, edit a parameter, adjust a weight, run it, toggle a what-if, toggle the dependents/location chips and re-run.

## Style notes

- No build step, no framework, no npm dependencies for the shipped app — keep it that way. The whole point is that a judge can open `index.html` with zero setup.
- Comments in `engine.js` and `llm.js` explaining *why* a design choice was made (not just what the code does) are genuinely part of this project's pitch — please keep that pattern going rather than stripping comments for brevity.
- Match the existing design tokens in `index.html`'s `<style>` block (CSS variables at the top) rather than hardcoding new colors.

## Reporting issues

Use the bug report or feature request templates under Issues. If it's a scoring bug, please include which two paths and what parameter values triggered it — that's usually enough to reproduce immediately.
