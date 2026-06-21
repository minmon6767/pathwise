/* ============================================================
   PATHWISE — Optional LLM Narrative Layer
   ============================================================
   WHY THIS EXISTS SEPARATELY FROM engine.js:

   The rules engine answers "what are the tradeoffs, numerically."
   That's necessarily mechanical — scores, confidence bands, deltas.
   But a number like "Financial: 6.5 at 3yr, confidence: medium"
   isn't something a stressed-out 21 year old can act on at 11pm.
   Turning structured tradeoffs into plain, specific, situation-
   aware language is a genuine NLP task — it benefits from a model
   that can read nuance in the user's own free-text description of
   their situation. That's the one thing the rules engine cannot do:
   it has no idea what "my parents really want me to take the safe
   option" means for a 22-year-old's actual constraints.

   So: rules layer = numbers (auditable, deterministic).
       LLM layer    = language (explanation, not decision-making).

   If no API key is provided, the app falls back to a template-based
   narrative generator (buildFallbackNarrative below) so the whole
   demo works with zero setup and zero cost. This file never lets
   the LLM touch the actual scores — it only receives them as
   read-only input and is explicitly instructed not to alter them.
   ============================================================ */

const NarrativeLayer = (() => {

  function buildPrompt(result, userContext) {
    return `You are helping a person think through a real decision. You will be given STRUCTURED, ALREADY-COMPUTED tradeoff scores. Do not invent new scores or contradict the given numbers. Your only job is to explain what they mean in plain, warm, specific language, and ask ONE good clarifying question the model couldn't see.

User's situation in their own words: "${userContext.freeText || "(not provided)"}"

Path A: ${result.pathA.label}
Path B: ${result.pathB.label}

Computed lean: ${result.lean.leaning === "tie" ? "Genuinely too close to call" : `Leans toward Path ${result.lean.leaning} (${result.lean.strength} lean)`}

Respond in 3 short paragraphs:
1. Plain-language summary of what the numbers actually mean for THIS person (use their free-text context if given)
2. One thing the numbers might be missing about their specific situation
3. One clarifying question that would change your read of this

Do not say "I recommend" or "you should." This is input to their thinking, not a verdict. Keep it under 150 words total.`;
  }

  async function generate(result, userContext, apiKey) {
    if (!apiKey) {
      return { source: "template", text: buildFallbackNarrative(result, userContext) };
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: buildPrompt(result, userContext) }]
        })
      });
      const data = await response.json();
      const text = (data.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n");
      return { source: "llm", text: text || buildFallbackNarrative(result, userContext) };
    } catch (e) {
      console.warn("LLM narrative call failed, falling back to template:", e);
      return { source: "template", text: buildFallbackNarrative(result, userContext) };
    }
  }

  // Deterministic, template-based fallback. Not "AI" — and we don't
  // pretend it is anywhere in the UI. This keeps the demo fully
  // functional for judges with zero API key and zero cost.
  function buildFallbackNarrative(result, userContext) {
    const { pathA, pathB, lean } = result;
    const leadName = lean.leaning === "A" ? pathA.label : lean.leaning === "B" ? pathB.label : null;
    const leadLens = lean.leaning === "A" ? pathA.strongestLens : lean.leaning === "B" ? pathB.strongestLens : null;

    let p1;
    if (lean.leaning === "tie") {
      p1 = `Based on the priorities you weighted, ${pathA.label} and ${pathB.label} land close enough that the numbers alone won't make this call for you — and that's an honest result, not a failure of the model.`;
    } else {
      p1 = `Weighted by what you said matters most, this currently leans toward ${leadName}, mainly because of its ${leadLens} profile — but the gap is ${lean.strength}, which matters as much as the direction.`;
    }

    const p2 = `What the numbers can't see: your actual risk appetite under pressure, what your support system looks like if year one is harder than expected, and whether either path matches how you personally recover from setbacks. Those aren't in this model on purpose — they're yours to know.`;

    const p3 = userContext.freeText
      ? `One question worth sitting with: if the harder path failed in year one, what would your realistic next move be — and would you be okay with it?`
      : `Try adding a sentence about your specific constraints (dependents, savings, location) — the comparison sharpens a lot once those are in.`;

    return [p1, p2, p3].join("\n\n");
  }

  return { generate, buildFallbackNarrative };
})();

if (typeof module !== "undefined") module.exports = NarrativeLayer;
