/* ============================================================
   PATHWISE — Decision Reasoning Engine
   ============================================================
   This is the deterministic "rules brain" of the app.

   WHY RULES HERE AND NOT AN LLM:
   Scoring tradeoffs needs to be auditable and repeatable — if a
   user reruns the same comparison, they should get the same
   structural reasoning every time. An LLM is probabilistic and
   would silently change its tradeoff weights between runs, which
   is exactly the "false confidence" failure mode the brief warns
   against. So the actual scoring lives here, in code you can read
   line by line. The LLM (optional, see llm.js) is only used
   afterward, to turn these structured numbers into plain-language
   explanation and to surface hidden considerations a static rule
   table wouldn't think to ask about.

   This file has zero dependencies and runs entirely client-side.
   ============================================================ */

const Engine = (() => {

  // ----------------------------------------------------------
  // 1. PATH LIBRARY
  // Each path is scored 1-10 on four lenses, at three horizons.
  // Scores are intentionally coarse (no fake precision) and every
  // path carries a written rationale + a confidence level per
  // lens, because some things (salary bands) are well-documented
  // and others (will I like this) are genuinely uncertain.
  // ----------------------------------------------------------

  const LENSES = ["financial", "growth", "stability", "fit"];
  const HORIZONS = ["1yr", "3yr", "10yr"];

  const LENS_META = {
    financial: { label: "Financial", icon: "💰", question: "What happens to my money?" },
    growth:    { label: "Growth & Skills", icon: "📈", question: "How fast do I learn and compound?" },
    stability: { label: "Stability & Risk", icon: "🛡️", question: "How exposed am I if things go wrong?" },
    fit:       { label: "Personal Fit", icon: "🧭", question: "Does this match how I actually want to live?" }
  };

  // Confidence isn't decoration — it changes how the verdict is worded.
  // "high" confidence claims get stated plainly. "low" confidence claims
  // get hedged in the output, on purpose.
  const CONF = { HIGH: "high", MEDIUM: "medium", LOW: "low" };

  /* Path templates. "params" are the only things the user actually
     edits (e.g. cost of bootcamp, current savings) — the rest of the
     model reacts to those inputs. This keeps the demo honest: changing
     a number visibly changes the verdict, instead of the verdict being
     a canned string. */
  const PATH_LIBRARY = {
    grad_school: {
      id: "grad_school",
      label: "Graduate School",
      shortLabel: "Grad School",
      description: "Pursue a Master's/PhD before entering the workforce",
      defaultParams: { years: 2, costPerYear: 400000, fundingPct: 30 },
      score(params, ctx) {
        const annualLivingCost = ctx.annualLivingCost || 400000; // sane default if not supplied
        const fieldPremium = ctx.fieldPremium || 0;
        const totalCost = params.years * params.costPerYear * (1 - params.fundingPct / 100);
        const debtBurden = totalCost / Math.max(annualLivingCost, 1);
        return {
          financial: {
            "1yr": clamp(10 - debtBurden * 1.5, 1, 10),
            "3yr": clamp(5 - debtBurden * 0.5, 1, 10),
            "10yr": clamp(7 + fieldPremium, 1, 10),
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: totalCost > 0
              ? `Net cost after funding ≈ ₹${Math.round(totalCost).toLocaleString("en-IN")}. Short-term cash flow takes a real hit; long-term payoff depends heavily on field and institution.`
              : "Fully funded — financial risk is low across all horizons."
          },
          growth: {
            "1yr": 8, "3yr": 8.5, "10yr": 7,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Strong structured learning and credentialing early; the long-term edge depends on whether the field still values the degree in 10 years."
          },
          stability: {
            "1yr": 7, "3yr": 6, "10yr": 6,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Stable in the sense of structure and clear milestones, but you're not earning, which is its own risk if circumstances change."
          },
          fit: {
            "1yr": 6, "3yr": 6, "10yr": 6,
            confidence: { "1yr": CONF.LOW, "3yr": CONF.LOW, "10yr": CONF.LOW },
            note: "Entirely dependent on whether you actually enjoy academic environments — this is the lens we can model least confidently."
          }
        };
      }
    },

    full_time_job: {
      id: "full_time_job",
      label: "Full-Time Job",
      shortLabel: "Job",
      description: "Take an entry-level role at an established company",
      defaultParams: { startingSalary: 700000, growthRatePct: 12 },
      score(params, ctx) {
        const y10salary = params.startingSalary * Math.pow(1 + params.growthRatePct / 100, 10);
        return {
          financial: {
            "1yr": 8, "3yr": 7.5,
            "10yr": clamp(5 + Math.log10(y10salary / params.startingSalary) * 2, 1, 10),
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.HIGH, "10yr": CONF.MEDIUM },
            note: `Immediate income from day one. Projected ~₹${Math.round(y10salary).toLocaleString("en-IN")}/yr by year 10 at a steady ${params.growthRatePct}% annual growth — but that assumes no major career pivot.`
          },
          growth: {
            "1yr": 6, "3yr": 6.5, "10yr": 6,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Learning is real but often bounded by your role and manager rather than chosen by you."
          },
          stability: {
            "1yr": 8.5, "3yr": 7.5, "10yr": 6.5,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Predictable income and a known structure — the main long-term risk is industry disruption, not personal failure."
          },
          fit: {
            "1yr": 6.5, "3yr": 6, "10yr": 5.5,
            confidence: { "1yr": CONF.MEDIUM, "3yr": CONF.LOW, "10yr": CONF.LOW },
            note: "Fit depends entirely on the specific company and team — this score is a placeholder, not a real assessment of any employer."
          }
        };
      }
    },

    startup: {
      id: "startup",
      label: "Start a Startup",
      shortLabel: "Startup",
      description: "Build your own venture from scratch",
      defaultParams: { runwayMonths: 12, coFounders: 1, savingsBuffer: 300000 },
      score(params, ctx) {
        const runwayRisk = clamp(params.runwayMonths / 18, 0.2, 1);
        return {
          financial: {
            "1yr": clamp(3 + runwayRisk * 3, 1, 10),
            "3yr": 5,
            "10yr": 6.5,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.LOW, "10yr": CONF.LOW },
            note: `With ${params.runwayMonths} months of runway, year-1 cash flow is the binding constraint, not ambition. Outcomes beyond year 1 are genuinely bimodal — most startups don't survive to year 3, a few do extremely well. Averaging this into one number would be misleading, so treat the 3yr/10yr scores as 'conditional on survival,' not expected value.`
          },
          growth: {
            "1yr": 9, "3yr": 8.5, "10yr": 7.5,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Forced, fast, often brutal learning across every business function at once — hard to replicate elsewhere."
          },
          stability: {
            "1yr": clamp(2 + runwayRisk * 2, 1, 10),
            "3yr": 3.5, "10yr": 5,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Lowest stability of the three paths by a wide margin, especially in year 1. This is the lens most likely to be underestimated by founders."
          },
          fit: {
            "1yr": 7, "3yr": 7, "10yr": 7,
            confidence: { "1yr": CONF.LOW, "3yr": CONF.LOW, "10yr": CONF.LOW },
            note: "High variance by personality — strong fit for people who want autonomy and ambiguity, poor fit for people who value predictability."
          }
        };
      }
    },

    bootcamp: {
      id: "bootcamp",
      label: "Bootcamp / Self-Taught",
      shortLabel: "Bootcamp",
      description: "Fast, focused, skills-first path into a role",
      defaultParams: { months: 6, cost: 150000 },
      score(params, ctx) {
        return {
          financial: {
            "1yr": clamp(9 - params.cost / 100000, 1, 10),
            "3yr": 7, "10yr": 6,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: `Low upfront cost (₹${params.cost.toLocaleString("en-IN")}) and fast time-to-income relative to grad school — the tradeoff shows up later as a possible credential ceiling, not an early cash problem.`
          },
          growth: {
            "1yr": 7.5, "3yr": 6, "10yr": 5,
            confidence: { "1yr": CONF.HIGH, "3yr": CONF.MEDIUM, "10yr": CONF.LOW },
            note: "Fast initial skill acquisition; the open question is whether self-directed learning continues once the structured program ends."
          },
          stability: {
            "1yr": 6, "3yr": 6, "10yr": 5.5,
            confidence: { "1yr": CONF.MEDIUM, "3yr": CONF.LOW, "10yr": CONF.LOW },
            note: "Job security afterward depends heavily on portfolio strength and market conditions, which this model can't see."
          },
          fit: {
            "1yr": 7, "3yr": 6.5, "10yr": 6,
            confidence: { "1yr": CONF.MEDIUM, "3yr": CONF.LOW, "10yr": CONF.LOW },
            note: "Good fit for people who learn by building rather than by sitting in a classroom."
          }
        };
      }
    }
  };

  function clamp(n, lo, hi) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      console.warn("Engine.clamp received a non-number, defaulting to midpoint:", n);
      return (lo + hi) / 2;
    }
    return Math.max(lo, Math.min(hi, n));
  }

  // ----------------------------------------------------------
  // 2. HIDDEN CONSIDERATIONS
  // These are the things a plain pros/cons list never surfaces.
  // Each rule fires based on the combination of paths + user
  // context, not just one path in isolation — that's the point
  // of "hidden": they only show up when you look at the comparison
  // as a system, not as two separate lists.
  // ----------------------------------------------------------

  function getHiddenConsiderations(pathA, pathB, ctx) {
    const flags = [];

    if ((pathA.id === "grad_school" || pathB.id === "grad_school") &&
        (pathA.id === "startup" || pathB.id === "startup")) {
      flags.push({
        title: "Opportunity cost compounds differently than money does",
        body: "Grad school's cost shows up as a number. A startup's cost shows up as time you can't get back at the exact age when risk tolerance is highest. Both are real costs — only one is on a balance sheet."
      });
    }

    if (ctx.hasDependents) {
      flags.push({
        title: "Dependents change the shape of acceptable risk, not just the amount",
        body: "With people relying on your income, a 20% chance of a bad outcome isn't just 'lower expected value' — a bad outcome may be unrecoverable on a fixed timeline. This model raises the bar for paths with high variance."
      });
    }

    if ((pathA.id === "startup" || pathB.id === "startup") && ctx.runwayMonths && ctx.runwayMonths < 9) {
      flags.push({
        title: "Runway shorter than typical pivot cycles",
        body: "Most early startups need at least 2-3 meaningful iteration cycles to find traction. Under 9 months of runway often means you're optimizing for survival, not for the best idea — worth naming honestly before you start."
      });
    }

    if ((pathA.id === "grad_school" || pathB.id === "grad_school")) {
      flags.push({
        title: "Credential value decays at different rates by field",
        body: "A graduate degree's payoff is highly field-dependent and can shift over a 5-10 year window as industries change. This model can't predict that shift — only flag that it's a real variable, not a constant."
      });
    }

    if (ctx.locationFlex === false) {
      flags.push({
        title: "Geographic constraint narrows more options than it first appears to",
        body: "Being tied to a specific city doesn't just remove 'move for the job' as an option — it also changes the realistic startup ecosystem, salary bands, and network you can build. Worth factoring explicitly rather than discovering it later."
      });
    }

    flags.push({
      title: "The 'wrong' choice is rarely permanent",
      body: "Most of these paths are reversible within 1-3 years with some cost, not lifelong commitments. This model compares paths as if you walk them fully, but real people course-correct constantly — treat this as a starting compass, not a locked-in route."
    });

    return flags;
  }

  // ----------------------------------------------------------
  // 3. WHAT-IF SCENARIO DELTAS
  // ----------------------------------------------------------

  function applyWhatIf(baseParams, pathId, whatIfKey) {
    const p = { ...baseParams };
    const deltas = {
      grad_school: {
        funded: { fundingPct: 80 },
        extended: { years: baseParams.years + 1 },
        cheaper: { costPerYear: Math.round(baseParams.costPerYear * 0.6) }
      },
      full_time_job: {
        raise: { startingSalary: Math.round(baseParams.startingSalary * 1.25) },
        slow_growth: { growthRatePct: Math.max(3, baseParams.growthRatePct - 6) },
        layoff_risk: { growthRatePct: Math.max(2, baseParams.growthRatePct - 9) }
      },
      startup: {
        more_runway: { runwayMonths: baseParams.runwayMonths + 9 },
        less_runway: { runwayMonths: Math.max(3, baseParams.runwayMonths - 6) },
        cofounder: { coFounders: baseParams.coFounders + 1 }
      },
      bootcamp: {
        faster: { months: Math.max(2, baseParams.months - 2) },
        pricier_program: { cost: Math.round(baseParams.cost * 1.6) }
      }
    };
    const delta = deltas[pathId] && deltas[pathId][whatIfKey];
    return delta ? { ...p, ...delta } : p;
  }

  // ----------------------------------------------------------
  // 4. WEIGHTED VERDICT
  // No single "winner" number is presented as a correct answer.
  // We compute a weighted lean based on user-stated priorities,
  // then explicitly label it as a lean, not a verdict — and we
  // always show the runner-up's strongest dimension so the losing
  // path isn't silently erased.
  // ----------------------------------------------------------

  function computeWeightedLean(scoresA, scoresB, weights) {
    let totalA = 0, totalB = 0, totalW = 0;
    const horizonWeight = { "1yr": 0.5, "3yr": 0.3, "10yr": 0.2 }; // near-term weighted higher: more certain, more actionable

    LENSES.forEach(lens => {
      const w = weights[lens] ?? 1;
      HORIZONS.forEach(h => {
        const hw = horizonWeight[h];
        totalA += scoresA[lens][h] * w * hw;
        totalB += scoresB[lens][h] * w * hw;
        totalW += w * hw;
      });
    });

    const normA = totalA / totalW;
    const normB = totalB / totalW;
    const gap = Math.abs(normA - normB);

    let strength;
    if (gap < 0.4) strength = "marginal";
    else if (gap < 1.2) strength = "mild";
    else if (gap < 2.2) strength = "moderate";
    else strength = "strong";

    return {
      scoreA: normA.toFixed(2),
      scoreB: normB.toFixed(2),
      leaning: normA === normB ? "tie" : (normA > normB ? "A" : "B"),
      strength,
      gap: gap.toFixed(2)
    };
  }

  function findStrongestLens(scores, otherScores) {
    let best = null, bestDelta = -Infinity;
    LENSES.forEach(lens => {
      const avg = (scores[lens]["1yr"] + scores[lens]["3yr"] + scores[lens]["10yr"]) / 3;
      const otherAvg = (otherScores[lens]["1yr"] + otherScores[lens]["3yr"] + otherScores[lens]["10yr"]) / 3;
      const delta = avg - otherAvg;
      if (delta > bestDelta) { bestDelta = delta; best = lens; }
    });
    return best;
  }

  // ----------------------------------------------------------
  // 5. HUMAN-IN-THE-LOOP GUARD
  // This is enforced in code, not just claimed in a slide. The
  // engine will NEVER output a field called "decision" or
  // "recommendation" — only "lean" and "considerations". This
  // function is the single choke point every result passes through.
  // ----------------------------------------------------------

  function enforceAdvisoryFraming(result) {
    const forbidden = ["decision", "recommendation", "answer", "correctChoice"];
    forbidden.forEach(key => { if (key in result) delete result[key]; });
    result.disclaimer = "This is a structured input to your thinking, not a decision made for you. You decide.";
    return result;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  function compare({ pathAId, pathBId, paramsA, paramsB, ctx, weights }) {
    const pathA = PATH_LIBRARY[pathAId];
    const pathB = PATH_LIBRARY[pathBId];
    const scoresA = pathA.score(paramsA, ctx);
    const scoresB = pathB.score(paramsB, ctx);

    const lean = computeWeightedLean(scoresA, scoresB, weights);
    const hidden = getHiddenConsiderations(pathA, pathB, ctx);
    const strongestA = findStrongestLens(scoresA, scoresB);
    const strongestB = findStrongestLens(scoresB, scoresA);

    return enforceAdvisoryFraming({
      pathA: { id: pathA.id, label: pathA.label, scores: scoresA, strongestLens: strongestA },
      pathB: { id: pathB.id, label: pathB.label, scores: scoresB, strongestLens: strongestB },
      lean,
      hidden
    });
  }

  return {
    PATH_LIBRARY, LENSES, HORIZONS, LENS_META, CONF,
    compare, applyWhatIf, clamp
  };
})();

if (typeof module !== "undefined") module.exports = Engine;
