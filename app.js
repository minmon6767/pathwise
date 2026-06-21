/* ============================================================
   PATHWISE — App Logic
   Wires Engine (engine.js) and NarrativeLayer (llm.js) to the DOM.
   No frameworks — kept deliberately simple so the architecture
   (rules vs LLM, see index.html "how" section) stays visible in
   the code itself, not just in a slide.
   ============================================================ */

const PATH_OPTIONS = Object.values(Engine.PATH_LIBRARY);

const PARAM_FIELDS = {
  grad_school: [
    { key: "years", label: "Years of program", type: "number", step: 1 },
    { key: "costPerYear", label: "Cost / year (₹)", type: "number", step: 10000 },
    { key: "fundingPct", label: "% funded / scholarship", type: "range", min: 0, max: 100 }
  ],
  full_time_job: [
    { key: "startingSalary", label: "Starting salary (₹/yr)", type: "number", step: 10000 },
    { key: "growthRatePct", label: "Expected annual growth %", type: "range", min: 0, max: 30 }
  ],
  startup: [
    { key: "runwayMonths", label: "Runway (months)", type: "number", step: 1 },
    { key: "coFounders", label: "Co-founders", type: "number", step: 1 },
    { key: "savingsBuffer", label: "Personal savings buffer (₹)", type: "number", step: 10000 }
  ],
  bootcamp: [
    { key: "months", label: "Program length (months)", type: "number", step: 1 },
    { key: "cost", label: "Total cost (₹)", type: "number", step: 5000 }
  ]
};

const WHATIF_OPTIONS = {
  grad_school: [
    { key: "funded", label: "What if I got 80% funding?" },
    { key: "extended", label: "What if it takes 1 extra year?" },
    { key: "cheaper", label: "What if I found a 40% cheaper program?" }
  ],
  full_time_job: [
    { key: "raise", label: "What if I negotiated a 25% higher offer?" },
    { key: "slow_growth", label: "What if growth slows?" },
    { key: "layoff_risk", label: "What if there's a layoff scare?" }
  ],
  startup: [
    { key: "more_runway", label: "What if I had 9 more months of runway?" },
    { key: "less_runway", label: "What if runway shrinks by 6 months?" },
    { key: "cofounder", label: "What if I bring on a co-founder?" }
  ],
  bootcamp: [
    { key: "faster", label: "What if I finished 2 months faster?" },
    { key: "pricier_program", label: "What if I pick a pricier program?" }
  ]
};

let state = {
  pathAId: "grad_school",
  pathBId: "full_time_job",
  paramsA: {},
  paramsB: {},
  weights: { financial: 5, growth: 5, stability: 5, fit: 5 },
  ctx: { hasDependents: false, locationFlex: true, freeText: "" },
  activeWhatIf: { A: null, B: null },
  lastResult: null
};

function initParams() {
  state.paramsA = { ...Engine.PATH_LIBRARY[state.pathAId].defaultParams };
  state.paramsB = { ...Engine.PATH_LIBRARY[state.pathBId].defaultParams };
}

function populateSelect(selectEl, excludeId) {
  selectEl.innerHTML = "";
  PATH_OPTIONS.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    selectEl.appendChild(opt);
  });
}

function renderParamFields(containerId, pathId, paramsKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const fields = PARAM_FIELDS[pathId] || [];
  fields.forEach(f => {
    const row = document.createElement("div");
    row.className = "param-row";
    const label = document.createElement("label");
    label.textContent = f.label;
    const input = document.createElement("input");
    input.type = f.type === "range" ? "range" : "number";
    if (f.min !== undefined) input.min = f.min;
    if (f.max !== undefined) input.max = f.max;
    if (f.step !== undefined) input.step = f.step;
    input.value = state[paramsKey][f.key];
    input.addEventListener("input", () => {
      state[paramsKey][f.key] = Number(input.value);
      if (f.type === "range") valSpan.textContent = input.value + (f.key.includes("Pct") ? "%" : "");
    });
    row.appendChild(label);
    row.appendChild(input);
    if (f.type === "range") {
      const valSpan = document.createElement("span");
      valSpan.style.fontFamily = "var(--mono)";
      valSpan.style.fontSize = "12px";
      valSpan.style.color = "var(--stone)";
      valSpan.textContent = input.value + (f.key.includes("Pct") ? "%" : "");
      row.appendChild(valSpan);
    }
    container.appendChild(row);
  });
}

function renderWeights() {
  const container = document.getElementById("weightRows");
  container.innerHTML = "";
  Engine.LENSES.forEach(lens => {
    const meta = Engine.LENS_META[lens];
    const row = document.createElement("div");
    row.className = "weight-row";
    row.innerHTML = `
      <label>${meta.icon} ${meta.label}</label>
      <input type="range" min="1" max="10" value="${state.weights[lens]}" data-lens="${lens}">
      <span class="wval">${state.weights[lens]}</span>
    `;
    const input = row.querySelector("input");
    const val = row.querySelector(".wval");
    input.addEventListener("input", () => {
      state.weights[lens] = Number(input.value);
      val.textContent = input.value;
    });
    container.appendChild(row);
  });
}

function setupPathPickers() {
  const selA = document.getElementById("pathA");
  const selB = document.getElementById("pathB");
  populateSelect(selA);
  populateSelect(selB);
  selA.value = state.pathAId;
  selB.value = state.pathBId;

  selA.addEventListener("change", () => {
    state.pathAId = selA.value;
    state.paramsA = { ...Engine.PATH_LIBRARY[state.pathAId].defaultParams };
    renderParamFields("paramsA", state.pathAId, "paramsA");
  });
  selB.addEventListener("change", () => {
    state.pathBId = selB.value;
    state.paramsB = { ...Engine.PATH_LIBRARY[state.pathBId].defaultParams };
    renderParamFields("paramsB", state.pathBId, "paramsB");
  });

  renderParamFields("paramsA", state.pathAId, "paramsA");
  renderParamFields("paramsB", state.pathBId, "paramsB");
}

function setupContextToggles() {
  const depChip = document.getElementById("chip-dependents");
  const locChip = document.getElementById("chip-location");
  depChip.addEventListener("click", () => {
    state.ctx.hasDependents = !state.ctx.hasDependents;
    depChip.classList.toggle("active", state.ctx.hasDependents);
  });
  locChip.addEventListener("click", () => {
    // chip "active" means user IS tied to one city => locationFlex = false
    const tied = locChip.classList.toggle("active");
    state.ctx.locationFlex = !tied;
  });
  document.getElementById("freeText").addEventListener("input", e => {
    state.ctx.freeText = e.target.value;
  });
}

function setupApiToggle() {
  const toggle = document.getElementById("useApiToggle");
  const field = document.getElementById("apiKeyField");
  toggle.addEventListener("change", () => {
    field.classList.toggle("show", toggle.checked);
  });
}

// ---------- Rendering results ----------

function scoreColor(lensVal) {
  // not used directly for node color (path color wins) — reserved if needed
  return lensVal;
}

function renderChart(result) {
  const wrap = document.getElementById("chartWrap");
  wrap.innerHTML = "";

  Engine.LENSES.forEach(lens => {
    const meta = Engine.LENS_META[lens];
    const scoresA = result.pathA.scores[lens];
    const scoresB = result.pathB.scores[lens];

    const block = document.createElement("div");
    block.className = "lens-chart";
    block.innerHTML = `
      <div class="lens-head">
        <span class="icon">${meta.icon}</span>
        <h4>${meta.label}</h4>
        <span class="q">${meta.question}</span>
      </div>
    `;

    const track = document.createElement("div");
    track.className = "track";
    const trackLine = document.createElement("div");
    trackLine.className = "track-line";
    track.appendChild(trackLine);

    const gates = document.createElement("div");
    gates.className = "track-gates";
    Engine.HORIZONS.forEach(h => {
      const gate = document.createElement("div");
      gate.className = "gate";
      const label = document.createElement("span");
      label.className = "gate-label";
      label.textContent = h;
      gate.appendChild(label);
      gates.appendChild(gate);
    });
    track.appendChild(gates);

    // Position nodes: each horizon gets an evenly spaced x position
    const positions = [16.6, 50, 83.4]; // % across, center of each third roughly
    Engine.HORIZONS.forEach((h, i) => {
      [["A", scoresA, "var(--line-a)"], ["B", scoresB, "var(--line-b)"]].forEach(([key, scores, color]) => {
        const val = scores[h];
        const conf = scores.confidence[h];
        const node = document.createElement("div");
        node.className = "node" + (conf === "low" ? " conf-low" : "");
        node.style.background = color;
        node.style.left = positions[i] + "%";
        // map score 1-10 to vertical position: top=10 (good), bottom=1
        const topPct = 12 + (1 - (val - 1) / 9) * 60;
        node.style.top = topPct + "%";
        node.title = `${key === "A" ? result.pathA.label : result.pathB.label} — ${h}: ${val.toFixed(1)}/10 (confidence: ${conf})`;
        track.appendChild(node);
      });
    });

    block.appendChild(track);

    // notes
    const noteWrap = document.createElement("div");
    noteWrap.style.marginTop = "26px";
    noteWrap.innerHTML = `
      <div class="note-line"><span class="tag a">A</span><p>${scoresA.note}</p></div>
      <div class="note-line"><span class="tag b">B</span><p>${scoresB.note}</p></div>
    `;
    block.appendChild(noteWrap);

    wrap.appendChild(block);
  });
}

function renderLegend(result) {
  document.getElementById("legend").innerHTML = `
    <div class="legend-item"><span class="legend-swatch" style="background:var(--line-a)"></span> ${result.pathA.label}</div>
    <div class="legend-item"><span class="legend-swatch" style="background:var(--line-b)"></span> ${result.pathB.label}</div>
    <div class="legend-item" style="color:var(--stone)">○ full opacity = high confidence · faded = lower confidence</div>
  `;
}

function renderLeanBanner(result) {
  const { lean, pathA, pathB } = result;
  let text;
  if (lean.leaning === "tie") {
    text = `Genuinely too close to call given your weights — ${pathA.label} (${lean.scoreA}) vs ${pathB.label} (${lean.scoreB}).`;
  } else {
    const winner = lean.leaning === "A" ? pathA : pathB;
    const other = lean.leaning === "A" ? pathB : pathA;
    text = `Leans toward <strong>${winner.label}</strong> <span class="strength-tag">${lean.strength} lean</span> — but ${other.label} still scores higher on ${Engine.LENS_META[other.strongestLens].label.toLowerCase()}.`;
  }
  document.getElementById("leanBanner").innerHTML = `
    <div class="lean-text">${text}</div>
    <div class="disclaimer">${result.disclaimer}</div>
  `;
}

function renderHidden(result) {
  const list = document.getElementById("hiddenList");
  list.innerHTML = "";
  result.hidden.forEach(h => {
    const card = document.createElement("div");
    card.className = "hidden-card";
    card.innerHTML = `<h4>${h.title}</h4><p>${h.body}</p>`;
    list.appendChild(card);
  });
}

function renderWhatIfButtons() {
  const row = document.getElementById("whatifRow");
  row.innerHTML = "";
  const optsA = WHATIF_OPTIONS[state.pathAId] || [];
  const optsB = WHATIF_OPTIONS[state.pathBId] || [];

  optsA.forEach(o => {
    const btn = document.createElement("button");
    btn.className = "whatif-btn";
    btn.textContent = "A: " + o.label;
    btn.addEventListener("click", () => {
      const active = state.activeWhatIf.A === o.key;
      state.activeWhatIf.A = active ? null : o.key;
      runComparison();
    });
    if (state.activeWhatIf.A === o.key) btn.classList.add("whatif-active");
    row.appendChild(btn);
  });
  optsB.forEach(o => {
    const btn = document.createElement("button");
    btn.className = "whatif-btn";
    btn.textContent = "B: " + o.label;
    btn.addEventListener("click", () => {
      const active = state.activeWhatIf.B === o.key;
      state.activeWhatIf.B = active ? null : o.key;
      runComparison();
    });
    if (state.activeWhatIf.B === o.key) btn.classList.add("whatif-active");
    row.appendChild(btn);
  });
}

async function renderNarrative(result) {
  const box = document.getElementById("narrativeBox");
  const sourceEl = document.getElementById("narrativeSource");
  box.textContent = "Generating explanation…";
  sourceEl.innerHTML = "";

  const useApi = document.getElementById("useApiToggle").checked;
  const apiKey = useApi ? document.getElementById("apiKeyInput").value.trim() : "";

  const { source, text } = await NarrativeLayer.generate(result, state.ctx, apiKey);
  box.textContent = text;
  sourceEl.innerHTML = source === "llm"
    ? `<span class="pill">LLM</span> Generated by Claude from the structured scores above — narration only, scores were not altered`
    : `<span class="pill">Template</span> Built-in narrator — no API key provided, no cost, fully deterministic`;
}

function runComparison() {
  let effParamsA = { ...state.paramsA };
  let effParamsB = { ...state.paramsB };
  if (state.activeWhatIf.A) effParamsA = Engine.applyWhatIf(state.paramsA, state.pathAId, state.activeWhatIf.A);
  if (state.activeWhatIf.B) effParamsB = Engine.applyWhatIf(state.paramsB, state.pathBId, state.activeWhatIf.B);

  const ctx = { ...state.ctx, runwayMonths: state.pathAId === "startup" ? effParamsA.runwayMonths : (state.pathBId === "startup" ? effParamsB.runwayMonths : null) };

  const result = Engine.compare({
    pathAId: state.pathAId,
    pathBId: state.pathBId,
    paramsA: effParamsA,
    paramsB: effParamsB,
    ctx,
    weights: state.weights
  });

  state.lastResult = result;
  document.getElementById("results").classList.add("show");
  renderLegend(result);
  renderLeanBanner(result);
  renderChart(result);
  renderHidden(result);
  renderWhatIfButtons();
  renderNarrative(result);

  ["step-1", "step-2", "step-3"].forEach(id => document.getElementById(id).classList.add("done"));
  document.getElementById("step-4").classList.add("active");

  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  initParams();
  setupPathPickers();
  renderWeights();
  setupContextToggles();
  setupApiToggle();
  document.getElementById("runBtn").addEventListener("click", runComparison);
});
