# Changelog

All notable changes to Pathwise are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-06-21

### Added
- Initial release for USAII's Global AI Hackathon 2026, Undergraduate Track, Challenge 3 (Direction A: Life Decision Simulator).
- Deterministic rules engine (`engine.js`) scoring four paths (Graduate School, Full-Time Job, Startup, Bootcamp/Self-Taught) across four lenses (financial, growth, stability, fit) at three time horizons (1yr, 3yr, 10yr), each with an explicit confidence band.
- Weighted "lean" computation based on user-set priority weights — structurally prevented from outputting a verdict-shaped field via `enforceAdvisoryFraming()`.
- Contextual hidden-consideration rules that fire based on the combination of chosen paths and user context (dependents, location flexibility, runway).
- What-if scenario deltas for all four path types.
- Optional LLM narrative layer (`llm.js`) using the Claude API, with a fully offline template-based fallback so the app works with zero API key.
- Single-file static UI (`index.html`) with a custom "flight path" chart visualization — no framework, no build step.
- Full documentation: README, CONTRIBUTING, Devpost submission draft, pitch script.
- GitHub Actions CI: syntax checks, full path-combination sweep for NaN/null regressions, human-in-the-loop guardrail check, and DOM-reference validation.

### Known limitations
- Path library covers four common routes with synthetic, editable default parameters — not live labor-market data.
- Designed as a structured input to a person's own thinking, not a financial planning tool.
