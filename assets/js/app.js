/* ==========================================================================
   Assessment engine. You shouldn't need to edit this file to change content —
   edit assets/js/questions.js instead.
   ========================================================================== */
(function () {
  "use strict";

  const DATA = window.ASSESSMENT;
  const S = DATA.settings;
  const STORE_KEY = "en18286-progress-v" + DATA.version;
  const app = document.getElementById("app");

  const TEXT_TYPES = ["text", "longtext", "email", "url", "country"];
  const isText = (q) => TEXT_TYPES.includes(q.type);
  const SKIP = "__skip"; // stored for an optional choice question the user skipped

  // ---------- Index ---------------------------------------------------------
  const ALL = [];
  DATA.chapters.forEach((ch, ci) => {
    ch.questions.forEach((q) => ALL.push(Object.assign({ chapter: ch, chapterIndex: ci }, q)));
  });
  const BY_ID = Object.fromEntries(ALL.map((q) => [q.id, q]));
  const ASSESSED = DATA.chapters.filter((c) => !c.scope);
  const SCOPE = DATA.chapters.find((c) => c.scope);
  const normOf = (q) => (q.role ? "context" : q.norm || "required");
  const isScored = (q) => !q.role && normOf(q) === "required";
  const isRec = (q) => !q.role && normOf(q) !== "required";
  const MAX_QUESTIONS = ALL.filter((q) => q.role !== "readiness").length;

  // The chapter's whole-area entry question (first question, unless entry: null)
  function entryOf(ch) {
    if (ch.entry === null) return null;
    if (ch.entry) return BY_ID[ch.entry];
    return ch.questions.length ? BY_ID[ch.questions[0].id] : null;
  }
  const isGate = (q) => !!q.gate || (!q.chapter.scope && entryOf(q.chapter) === q);

  // ---------- State ---------------------------------------------------------
  const newState = (label) => ({
    answers: {}, notes: {}, times: {}, label: label || "", current: null, date: null,
    maxChapter: 0, screeningSeen: false, ids: { company: makeId("company"), system: makeId("system") }
  });
  let state = newState("");
  let viewingShared = false;

  // ---------- Utilities -----------------------------------------------------
  function makeId(prefix) {
    try {
      const b = new Uint8Array(6);
      crypto.getRandomValues(b);
      return prefix + "-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    } catch (e) { return prefix + "-" + Date.now().toString(36); }
  }
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) {} },
    clear() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }
  };
  function b64urlEncode(str) {
    let bin = "";
    new TextEncoder().encode(str).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  }
  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return iso; }
  }
  const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");
  const sourceText = (q) => (q.source ? q.source : q.ref ? S.refPrefix + q.ref : (S.extraSources || {})[q.id] || "");
  const NORM_LABEL = {
    required: "Required (shall)",
    recommended: "Recommended (should)",
    optional: "Optional (may)",
    context: "Context / screening",
    readiness: "Readiness · not scored"
  };
  const normKey = (q) => (q.role === "readiness" ? "readiness" : normOf(q));

  // ---------- Applicability -------------------------------------------------
  function isDeployerOnly(answers) {
    return (S.deployerOnlyAnswers || []).includes(answers[S.roleQuestion]);
  }
  const hiddenForRole = (q, answers) => !!(q.providerOnlySkip || q.chapter.providerOnlySkip) && isDeployerOnly(answers);

  // The options a respondent actually sees, given their role.
  function effOptions(q, answers) {
    if (!q.options) return [];
    const dep = isDeployerOnly(answers);
    const opts = dep ? q.options.filter((o) => !o.providerOnly) : q.options.slice();
    if (dep && q.providerOnly && !opts.some((o) => o.na)) {
      opts.push({ id: "NA", text: q.naText || S.providerNAText, na: true, exclusive: true, auto: true });
    }
    return opts;
  }

  // Normalised answer: single → option id | null; multi → { sel: [...], na: [...] } | null; text → string | null
  function getAnswer(q, answers) {
    const raw = answers[q.id];
    if (raw == null) return null;
    if (isText(q)) return typeof raw === "string" ? raw : null;
    const ids = effOptions(q, answers).map((o) => o.id);
    if (q.type === "single") return ids.includes(raw) ? raw : null;
    const arr = Array.isArray(raw) ? raw : [];
    const sel = arr.filter((x) => x[0] !== "~" && ids.includes(x));
    const na = q.allowItemNA ? arr.filter((x) => x[0] === "~").map((x) => x.slice(1)).filter((x) => ids.includes(x)) : [];
    return { sel, na };
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const URL_RE = /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i;
  function textValid(q, v) {
    v = String(v || "").trim();
    if (!v) return !!q.optional;
    if (q.type === "email") return EMAIL_RE.test(v);
    if (q.type === "url") return URL_RE.test(v);
    return true;
  }

  function isAnswered(q, answers) {
    if (isText(q)) {
      const v = answers[q.id];
      return v != null && textValid(q, v);
    }
    if (q.optional && answers[q.id] === SKIP) return true;
    const a = getAnswer(q, answers);
    if (q.type === "single") return a != null;
    if (!a) return false;
    if (a.sel.length) return true;
    const req = effOptions(q, answers).filter((o) => o.required);
    return a.na.length > 0 && req.every((o) => a.na.includes(o.id));
  }

  // ---------- Branching -----------------------------------------------------
  function condOk(c, answers) {
    const tq = BY_ID[c.question];
    if (!tq) return true;
    if (!isVisible(tq, answers)) return false;
    const a = getAnswer(tq, answers);
    const eff = effOptions(tq, answers);
    if (tq.type === "multi") {
      const sel = a ? a.sel : [];
      if (sel.some((id) => { const o = eff.find((x) => x.id === id); return o && o.na; })) return false;
      if (c.is) return sel.some((x) => c.is.includes(x));
      if (c.not) return !sel.some((x) => c.not.includes(x));
      return true;
    }
    if (tq.type === "single" && a != null) {
      const o = eff.find((x) => x.id === a);
      if (o && o.na) return false; // "Not applicable" skips everything that depends on it
    }
    if (c.is) return a != null && c.is.includes(a);
    if (c.not) return a == null || !c.not.includes(a);
    return true;
  }
  function condMet(c, answers) {
    if (!c) return true;
    return Array.isArray(c) ? c.every((x) => condOk(x, answers)) : condOk(c, answers);
  }
  const isVisible = (q, answers) => !hiddenForRole(q, answers) && condMet(q.showIf, answers);
  const visibleQuestions = (answers) => ALL.filter((q) => isVisible(q, answers));

  // Why a hidden question is hidden:
  //   gated   → a process gate it depends on was answered "no process": counts as unmet
  //   skipped → it doesn't apply given the answers: listed with a reason, not scored
  function whyHidden(q, answers) {
    if (hiddenForRole(q, answers)) return { kind: "skipped", reason: q.naText || S.providerNAText };
    const conds = q.showIf ? [].concat(q.showIf) : [];
    for (const c of conds) {
      if (condOk(c, answers)) continue;
      const g = BY_ID[c.question];
      if (!g) continue;
      if (!isVisible(g, answers)) {
        if (g.role) return { kind: "skipped", reason: q.skipReason || g.skipReason || defaultReason(g) };
        const up = whyHidden(g, answers);
        return up.kind === "gated" ? up : { kind: "skipped", reason: q.skipReason || up.reason };
      }
      const r = scoreQuestion(g, answers);
      if (r && r.status === "na") return { kind: "skipped", reason: r.answerText[0] || "Not applicable." };
      if (isGate(g) && r && r.status === "scored") return { kind: "gated", gate: g };
      return { kind: "skipped", reason: q.skipReason || defaultReason(g) };
    }
    return { kind: "skipped", reason: q.skipReason || "Not shown, based on your answers." };
  }
  const defaultReason = (g) => `Not shown because of your answer to “${g.topic}”.`;

  // ---------- Scoring -------------------------------------------------------
  function scoreQuestion(q, answers) {
    if (isText(q)) return null;
    const a = getAnswer(q, answers);
    const opts = effOptions(q, answers);
    if (q.type === "single") {
      const opt = opts.find((o) => o.id === a);
      if (!opt) return null;
      const answerText = [opt.text];
      if (opt.na) return { status: "na", answerText };
      if (opt.unsure) return { status: "unsure", answerText };
      const best = opts.reduce((m, o) => (typeof o.score === "number" && o.score > m.score ? o : m), { score: -1 });
      return { status: "scored", score: opt.score, answerText, target: best.text };
    }
    if (!a || (!a.sel.length && !a.na.length)) return null;
    const chosen = opts.filter((o) => a.sel.includes(o.id));
    const answerText = chosen.map((o) => o.text);
    const naItems = opts.filter((o) => a.na.includes(o.id)).map((o) => o.text);
    if (chosen.some((o) => o.na)) return { status: "na", answerText };
    if (chosen.some((o) => o.unsure)) return { status: "unsure", answerText };
    const req = opts.filter((o) => o.required && !a.na.includes(o.id));
    if (!req.length) return { status: "na", answerText: [], naItems, allItemsNA: true };
    const all = chosen.some((o) => o.all);
    const hit = all ? req : req.filter((o) => a.sel.includes(o.id));
    const missing = all ? [] : req.filter((o) => !a.sel.includes(o.id)).map((o) => o.text);
    return { status: "scored", score: (3 * hit.length) / req.length, answerText, missing, naItems, hit: hit.length, of: req.length };
  }

  const maturityFor = (avg) =>
    S.maturityBands.find((b) => avg >= b.min - 1e-9) || S.maturityBands[S.maturityBands.length - 1];

  function severity(r) {
    if (r.score === 0) return { key: "missing", label: "Missing" };
    if (r.score < 1.5) return { key: "informal", label: "Informal" };
    return { key: "partial", label: "Partial" };
  }

  function chapterResult(ch, answers) {
    const qs = ALL.filter((q) => q.chapter === ch);
    const dep = isDeployerOnly(answers);
    const base = {
      ch, met: 0, total: 0, avg: 0, partial: 0, missing: 0, unsure: 0, na: 0,
      gaps: [], gateGaps: [], unsureItems: [], naList: [], skipped: [], recs: [], readinessList: [], gatedIds: new Set()
    };

    if (ch.providerOnlySkip && dep) {
      return Object.assign(base, { notApplicable: true, naReason: S.providerNAText, maturity: null });
    }
    const entry = entryOf(ch);
    if (entry) {
      const entryAns = getAnswer(entry, answers);
      const entryOpt = entryAns != null && effOptions(entry, answers).find((o) => o.id === entryAns);
      if (entryOpt && entryOpt.na) {
        return Object.assign(base, { notApplicable: true, naReason: entryOpt.text, maturity: null });
      }
    }

    const items = [], gated = [], readiness = [];
    qs.forEach((q) => {
      if (q.role === "readiness") {
        if (!isVisible(q, answers)) return;
        const o = effOptions(q, answers).find((x) => x.id === getAnswer(q, answers));
        const conds = q.showIf ? [].concat(q.showIf) : [];
        readiness.push({ q, label: o ? o.readiness : null, gateId: conds.length === 1 ? conds[0].question : null });
        return;
      }
      if (q.role) return; // context questions are never scored
      const vis = isVisible(q, answers);
      if (isRec(q)) {
        if (vis) { const r = scoreQuestion(q, answers); if (r) base.recs.push(Object.assign({ q }, r)); }
        return;
      }
      if (vis) {
        const r = scoreQuestion(q, answers);
        if (r) items.push(Object.assign({ q }, r));
        return;
      }
      const why = whyHidden(q, answers);
      if (why.kind === "gated") {
        if (dep && q.providerOnly) return;
        gated.push({ q, gate: why.gate });
      } else {
        base.skipped.push({ q, reason: why.reason });
      }
    });

    // Gates whose dependents were skipped because no process exists
    const gates = [];
    gated.forEach((g) => { if (!gates.includes(g.gate)) gates.push(g.gate); });
    // A provider-only gate isn't counted for a deployer when its area is skipped (matches the original logic)
    const counted = items.filter((i) => !(dep && i.q.providerOnly && gates.includes(BY_ID[i.q.id])));
    const scored = counted.filter((i) => i.status === "scored");
    const r = base;

    r.unsureItems = counted.filter((i) => i.status === "unsure");
    r.unsure = r.unsureItems.length;
    r.naList = counted
      .filter((i) => i.status === "na" || (i.naItems && i.naItems.length))
      .map((i) => ({ q: i.q, whole: i.status === "na", items: i.naItems || [], answerText: i.answerText }));
    r.na = counted.filter((i) => i.status === "na").length;

    r.total = scored.length + gated.length;
    r.met = scored.filter((i) => i.score >= 3 - 1e-9).length;
    r.missing = scored.filter((i) => i.score === 0).length + gated.length;
    r.partial = r.total - r.met - r.missing;
    r.avg = r.total ? scored.reduce((s, i) => s + i.score, 0) / r.total : 0;
    r.gatedIds = new Set(gated.map((g) => g.q.id));
    r.gateGaps = gates.map((g) => {
      const plan = readiness.find((x) => x.gateId === g.id);
      return { gate: g, count: gated.filter((x) => x.gate === g).length, readiness: plan ? plan.label : null, planQ: plan ? plan.q : null };
    });
    r.readinessList = readiness.filter((x) => !r.gateGaps.some((gg) => gg.planQ === x.q));
    r.gaps = scored
      .filter((i) => i.score < 3 - 1e-9 && !gates.includes(BY_ID[i.q.id]))
      .sort((x, y) => x.score - y.score || (y.q.key ? 1 : 0) - (x.q.key ? 1 : 0))
      .map((i) => Object.assign(i, { sev: severity(i) }));
    r.branched = entry ? gates.includes(entry) : false;
    r.readiness = r.branched ? r.gateGaps.find((g) => g.gate === entry).readiness : null;
    r.maturity = maturityFor(r.avg);
    r.insufficient = r.total === 0;
    r.provisional = !r.insufficient && r.unsure / (r.total + r.unsure) >= S.provisionalThreshold;
    r.nothingApplies = r.total === 0 && r.unsure === 0 && r.na === 0 && !r.recs.length && r.skipped.length > 0;
    return r;
  }

  function overallResult(answers) {
    const chapters = ASSESSED.map((ch) => chapterResult(ch, answers));
    const app = chapters.filter((c) => !c.notApplicable);
    const sum = (k) => app.reduce((s, c) => s + c[k], 0);
    const withData = app.filter((c) => c.total > 0);
    const R = {
      chapters,
      met: sum("met"), total: sum("total"), partial: sum("partial"), missing: sum("missing"),
      unsure: sum("unsure"), na: sum("na"),
      avg: withData.length ? withData.reduce((s, c) => s + c.avg, 0) / withData.length : 0,
      gapCount: app.reduce((s, c) => s + c.gaps.length + c.gateGaps.length, 0),
      naChapters: chapters.filter((c) => c.notApplicable).length,
      recCount: app.reduce((s, c) => s + c.recs.length, 0)
    };
    R.maturity = maturityFor(R.avg);
    R.insufficient = R.total === 0;
    R.provisional = !R.insufficient && R.unsure / (R.total + R.unsure) >= S.provisionalThreshold;
    return R;
  }

  // ---------- Applicability screening ---------------------------------------
  // Three outcomes only: A appears applicable · B does not appear applicable · C cannot be determined.
  function screening(answers) {
    const val = (id) => {
      const q = BY_ID[id];
      if (!q || !isVisible(q, answers)) return q && q.type === "multi" ? [] : null;
      const a = getAnswer(q, answers);
      return q.type === "multi" ? (a ? a.sel : []) : a;
    };
    const p09 = val("P09"), p10 = val("P10"), p11 = val("P11"), role = val(S.roleQuestion);
    const p12 = val("P12"), p14 = val("P14"), p14a = val("P14A"), p15 = val("P15");
    const reasons = [], notes = [], conflicts = [];

    // 1. Provider role (incl. Article 25)
    const prov = [];
    if (["A", "B", "C"].some((x) => p09.includes(x))) prov.push("you develop AI systems, have them developed, or offer them under your company name");
    if (p10 === "A") prov.push("you place an AI system on the EU market or put it into service under your own name");
    if (p10 === "B") prov.push("you plan to place an AI system on the EU market or put it into service under your own name");
    if (["A", "B", "C"].some((x) => p11.includes(x))) prov.push("you rebranded, substantially modified or changed the purpose of a third-party AI system, which can make you its provider (Article 25)");
    if (role === "A" || role === "C") prov.push("you described your role as provider");
    let provider = "unknown";
    if (prov.length) provider = "yes";
    else if (p10 === "C" && !p09.includes("J") && !p11.includes("E") && role !== "D" && p09.length) provider = "no";
    if (p09.includes("I") && p10 === "A") conflicts.push("You selected no AI activities but also said the company places an AI system on the EU market.");
    if (role === "B" && prov.length && (p10 === "A" || p10 === "B" || ["A", "B", "C"].some((x) => p11.includes(x))))
      notes.push("You described your company as a deployer, but other answers suggest provider obligations may apply.");
    if (provider === "yes") reasons.push("Provider role: " + prov[0] + ".");
    else if (provider === "no") reasons.push("Provider role: your answers do not identify your company as a provider of this AI system.");
    else reasons.push("Provider role: not clear from your answers.");

    // 2. Connection to the EU
    let eu = "unknown";
    if (["A", "B", "C", "D"].some((x) => p12.includes(x))) eu = "yes";
    else if (p12.includes("E")) eu = "no";
    reasons.push(eu === "yes" ? "EU connection: identified." : eu === "no" ? "EU connection: none known." : "EU connection: not clear from your answers.");

    // 3. High-risk classification
    const annex3 = ["A", "B", "C", "D", "E", "F", "G", "H"].some((x) => p14.includes(x));
    const annex1 = p14.includes("I");
    let hr = "unknown", hrLine = "";
    if (annex1) { hr = "yes"; hrLine = "safety component of a product covered by EU product legislation (Annex I)."; }
    if (annex3) {
      let a3 = "unknown";
      if (p14a === "A") a3 = "yes";
      else if (p14a === "B") {
        if (p15 === "A") { a3 = "yes"; notes.push("You claimed the Article 6(3) exception, but the system profiles individuals, so the exception does not apply."); }
        else if (p15 === "B") a3 = "exempt";
        else notes.push("The Article 6(3) exception can't be confirmed while it is unclear whether the system profiles individuals.");
      } else if (p14a === "C") notes.push("The Article 6(3) exception requires a documented assessment before the system is placed on the market.");
      if (hr !== "yes") {
        hr = a3 === "yes" ? "yes" : a3 === "exempt" ? "no" : "unknown";
        hrLine = a3 === "yes" ? "intended use in an Annex III high-risk area." : a3 === "exempt" ? "Annex III use area, but a documented Article 6(3) exception without profiling." : "Annex III use area, but the classification is not settled.";
      }
    }
    if (!annex1 && !annex3) {
      if (p14.includes("J")) { hr = "no"; hrLine = "no high-risk use identified."; }
      else hrLine = "not clear from your answers.";
    }
    reasons.push("High-risk classification: " + hrLine);
    notes.push("Exclusions under Article 2 of the EU AI Act (for example military, scientific research or purely personal use) depend on the facts and are not assessed here.");

    let outcome;
    if (conflicts.length) outcome = "C";
    else if (provider === "no" || eu === "no" || hr === "no") outcome = "B";
    else if (provider === "yes" && eu === "yes" && hr === "yes") outcome = "A";
    else outcome = "C";

    const dates = [];
    if (S.commencement) {
      if (annex3 && (hr === "yes" || hr === "unknown")) dates.push(`Annex III high-risk systems: obligations apply from ${S.commencement.annex3}.`);
      if (annex1) dates.push(`Annex I product-related high-risk systems: obligations apply from ${S.commencement.annex1}.`);
    }
    const T = {
      A: { title: "Requirements appear applicable", short: "Appears applicable", tone: "good",
        text: "Your answers suggest the company is a provider of a high-risk AI system with a connection to the EU. The EU AI Act quality management system requirement (Article 17), which EN 18286 supports, appears to apply." },
      B: { title: "Requirements do not appear applicable", short: "Voluntary assessment — no QMS obligation identified", tone: "low",
        text: "Your answers do not identify a provider obligation for a high-risk AI system. You can continue as a voluntary assessment: the results are then good-practice indications, not mandatory gaps." },
      C: { title: "Applicability cannot be determined", short: "Indicative — applicability unconfirmed", tone: "none",
        text: "Your answers are incomplete or point in different directions, so applicability can’t be determined. You can continue; the report will be labelled “indicative / applicability unconfirmed”." }
    }[outcome];
    return Object.assign({ outcome, reasons, notes, conflicts, dates }, T);
  }

  // ---------- Share links ---------------------------------------------------
  // Only multiple-choice answers and the optional label are shared. Free text,
  // contact details and evidence notes never leave the browser this way.
  function encodeResult() {
    const parts = visibleQuestions(state.answers)
      .filter((q) => !isText(q) && isAnswered(q, state.answers))
      .map((q) => {
        const a = getAnswer(q, state.answers);
        if (a == null) return null;
        return q.id + "=" + (q.type === "multi" ? a.sel.join("") + a.na.map((x) => "~" + x).join("") : a);
      })
      .filter(Boolean);
    const payload = { v: DATA.version, a: parts.join(";"), d: state.date };
    if (state.label) payload.l = state.label;
    return b64urlEncode(JSON.stringify(payload));
  }

  function decodeResult(str) {
    try {
      const p = JSON.parse(b64urlDecode(str));
      const answers = {};
      (p.a || "").split(";").filter(Boolean).forEach((pair) => {
        const [id, val] = pair.split("=");
        const q = BY_ID[id];
        if (!q || !val || !q.options) return;
        const valid = q.options.map((o) => o.id).concat("NA").sort((x, y) => y.length - x.length);
        if (q.type === "multi") {
          const ids = [];
          let rest = val;
          while (rest.length) {
            let prefix = "";
            if (rest[0] === "~") { prefix = "~"; rest = rest.slice(1); }
            const m = valid.find((v) => rest.startsWith(v));
            if (!m) break;
            ids.push(prefix + m);
            rest = rest.slice(m.length);
          }
          if (ids.length) answers[id] = ids;
        } else if (valid.includes(val)) {
          answers[id] = val;
        }
      });
      return { answers, label: p.l || "", date: p.d || null, version: p.v };
    } catch (e) {
      return null;
    }
  }
  const shareUrl = () => location.href.split("#")[0] + "#r=" + encodeResult();

  // ---------- Views ---------------------------------------------------------
  function render(html) {
    app.innerHTML = html;
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  const companyName = () => (typeof state.answers[S.companyNameQuestion] === "string" ? state.answers[S.companyNameQuestion].trim() : "");
  const systemDesc = () => (typeof state.answers[S.systemDescriptionQuestion] === "string" ? state.answers[S.systemDescriptionQuestion].trim() : "");

  // Intro ------------------------------------------------------------------
  function viewIntro() {
    viewingShared = false;
    clearHash();
    const saved = store.get();
    const hasProgress = saved && saved.answers && Object.keys(saved.answers).length > 0 && !saved.completed;

    let n = 0;
    const partsHtml = ["A", "B", "C"].map((p) => {
      const chs = ASSESSED.filter((c) => c.part === p);
      if (!chs.length) return "";
      const P = (S.parts || {})[p] || { title: "Part " + p };
      return `
        <h3 class="part-title">${esc(P.title)}${P.intro ? `<span>${esc(P.intro)}</span>` : ""}</h3>
        <ol class="areas">${chs.map((ch) => {
          n = ASSESSED.indexOf(ch) + 1;
          return `<li class="area"><span class="area-num">${String(n).padStart(2, "0")}</span><div><h3>${esc(ch.title)}</h3><p>${esc(ch.intro)}</p></div></li>`;
        }).join("")}</ol>`;
    }).join("");

    render(`
      <section class="intro">
        <p class="eyebrow">EU AI Act · Quality management self-assessment</p>
        <h1>How ready is your AI quality management system?</h1>
        <p class="lead">A structured self-assessment for organisations with high-risk AI systems, built against
          <strong>${esc(S.standardShort)}</strong>, the European standard for quality management systems under the EU AI Act.
          Start with a short company profile and applicability check, answer the company-level questions once, then
          assess one AI system. You get a gap report you can act on and share.</p>

        <ul class="meta">
          <li><span class="meta-k">${ASSESSED.length}</span> chapters in 3 parts</li>
          <li>up to <span class="meta-k">${MAX_QUESTIONS}</span> questions, fewer with branching</li>
          <li><span class="meta-k">~45</span> minutes · save and resume</li>
          <li><span class="meta-k">0</span> data collected</li>
        </ul>

        <div class="start-card">
          <label class="field">
            <span class="field-label">Assessment label <span class="optional">optional</span></span>
            <input id="label" type="text" maxlength="80" placeholder="e.g. Company name, or the AI system you're assessing" value="${esc(hasProgress ? saved.label || "" : "")}" />
            <span class="field-hint">Shown on your report and share link. Nothing is sent to us.</span>
          </label>
          <div class="actions">
            <button class="btn btn-primary" id="start">${hasProgress ? "Start over" : "Start the assessment"}</button>
            ${hasProgress ? `<button class="btn btn-secondary" id="resume">Resume where you left off</button>` : ""}
          </div>
        </div>

        <div class="privacy-note">
          <p class="note-title">Privacy</p>
          <p>Your answers are kept only in this browser so you can resume. Contact details are optional. Share links carry
            your multiple-choice answers and label only — never your company profile text, contact details, AI system
            description or evidence notes. Nothing is shared or exported unless you choose to, and you'll be asked to confirm first.</p>
        </div>

        <h2 class="section-title">What's covered</h2>
        <div class="part-block"><h3 class="part-title">Company Profile & Applicability<span>Not scored. Decides whether the requirements appear to apply.</span></h3></div>
        ${partsHtml}

        <p class="disclaimer">This tool is an indicative self-assessment. It is not a conformity assessment, an audit, or legal advice.
          Requirements are written mainly for providers; deployers are not marked down for activities their provider controls.
          ${esc(S.reportDisclaimer)}</p>
      </section>
    `);

    document.getElementById("start").addEventListener("click", () => {
      if (hasProgress && !confirm("Start over? Your saved answers will be cleared from this browser.")) return;
      state = newState(document.getElementById("label").value.trim());
      state.current = ALL[0].id;
      persist();
      viewQuestion();
    });
    const resume = document.getElementById("resume");
    if (resume)
      resume.addEventListener("click", () => {
        state = Object.assign(newState(""), saved);
        state.notes = state.notes || {};
        state.times = state.times || {};
        state.label = document.getElementById("label").value.trim() || state.label;
        if (!BY_ID[state.current] || !isVisible(BY_ID[state.current], state.answers)) state.current = visibleQuestions(state.answers)[0].id;
        viewQuestion();
      });
  }

  // Question ---------------------------------------------------------------
  function viewQuestion() {
    const vis = visibleQuestions(state.answers);
    let idx = vis.findIndex((q) => q.id === state.current);
    if (idx < 0) idx = 0;
    const q = vis[idx];
    state.current = q.id;
    const ch = q.chapter;
    state.maxChapter = Math.max(state.maxChapter || 0, q.chapterIndex);

    const chVis = vis.filter((x) => x.chapter === ch);
    const posInCh = chVis.findIndex((x) => x.id === q.id) + 1;
    const answeredCount = vis.filter((x) => isAnswered(x, state.answers)).length;
    const pct = Math.round((answeredCount / vis.length) * 100);
    const assessedIdx = ASSESSED.indexOf(ch);
    const partLabel = ch.part ? `Part ${ch.part} · ` : "";
    const sectionLabel = ch.scope ? esc(ch.title) : `${partLabel}Chapter ${assessedIdx + 1} of ${ASSESSED.length} · ${esc(ch.title)}`;

    const stepper = DATA.chapters
      .map((c, i) => {
        const cls = i < q.chapterIndex ? "done" : i === q.chapterIndex ? "active" : "";
        const n = c.scope ? "" : ASSESSED.indexOf(c) + 1;
        const reachable = i <= state.maxChapter && i !== q.chapterIndex && firstVisibleIn(c, vis);
        return `<li class="step ${cls} ${c.scope ? "step-scope" : ""}">
          <button type="button" class="step-btn" data-ch="${i}" ${reachable ? "" : "disabled"} title="${esc((c.part ? "Part " + c.part + " · " : "") + c.title)}" aria-label="${esc(c.title)}${reachable ? " — go to this chapter" : ""}">
            <span class="step-dot">${i < q.chapterIndex ? checkIcon() : n || scopeIcon()}</span><span class="step-label">${esc(c.title)}</span>
          </button></li>`;
      })
      .join("");

    const multi = q.type === "multi";
    const opts = effOptions(q, state.answers);
    const a = getAnswer(q, state.answers);
    let body;
    if (isText(q)) {
      body = textInputHtml(q, a);
    } else {
      const optHtml = opts
        .map((o) => {
          const checked = multi ? a && a.sel.includes(o.id) : a === o.id;
          const isNA = multi && a && a.na.includes(o.id);
          const canNA = multi && q.allowItemNA && o.required;
          return `
          <div class="option-row ${canNA ? "has-na" : ""} ${isNA ? "is-na" : ""}" data-id="${esc(o.id)}">
            <label class="option ${checked ? "checked" : ""} ${o.exclusive ? "is-exclusive" : ""}">
              <input type="${multi ? "checkbox" : "radio"}" name="opt" value="${esc(o.id)}" ${checked ? "checked" : ""} />
              <span class="option-mark" aria-hidden="true"></span>
              <span class="option-text">${esc(o.text)}</span>
            </label>
            ${canNA ? `<button type="button" class="na-toggle" data-id="${esc(o.id)}" aria-pressed="${isNA ? "true" : "false"}" aria-label="Mark “${esc(o.text)}” as not applicable">N/A</button>` : ""}
          </div>`;
        })
        .join("");
      body = `<fieldset class="options" aria-labelledby="qtext">${optHtml}</fieldset>`;
    }

    const hint = isText(q) ? [q.optional ? "Optional — you can skip this" : "Required"] : [multi ? "Select all that apply" : "Select one answer"];
    if (multi && q.allowItemNA) hint.push("mark anything that doesn't apply to your AI systems as N/A");
    if (!isText(q) && q.optional) hint.push("optional");
    const isLast = idx === vis.length - 1;
    const src = sourceText(q);
    const nk = normKey(q);
    const canNote = !q.role;
    const note = (state.notes && state.notes[q.id]) || "";
    const sys = ch.part === "C" && systemDesc() ? `<p class="qsystem"><span>AI system</span>${esc(truncate(systemDesc(), 110))}</p>` : "";

    render(`
      <section class="quiz">
        <ol class="stepper ${DATA.chapters.length > 6 ? "many" : ""}" aria-label="Assessment chapters">${stepper}</ol>
        <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Overall progress">
          <span style="width:${pct}%"></span>
        </div>
        <article class="qcard">
          <p class="qmeta">${sectionLabel} · Question ${posInCh} of ${chVis.length}</p>
          ${sys}
          <h2 class="qtext" id="qtext">${esc(q.text)}</h2>
          <p class="qsource"><span class="norm norm-${nk}">${esc(NORM_LABEL[nk])}</span>${src ? `<span>Source: ${esc(src)}</span>` : `<span>Company profile · not scored</span>`}</p>
          <p class="qhint">${esc(hint.join(" · "))}</p>
          ${q.help ? `<p class="qhelp">${esc(q.help)}</p>` : ""}
          ${body}
          ${canNote ? `
          <details class="evidence" id="evidence" ${note ? "open" : ""} hidden>
            <summary>Evidence note <span class="optional">optional</span></summary>
            <textarea id="enote" rows="3" maxlength="600" placeholder="e.g. document name, link or owner">${esc(note)}</textarea>
            <span class="field-hint">Stays in this browser. Included in JSON export, never in share links.</span>
          </details>` : ""}
          <div class="qnav">
            <button class="btn btn-ghost" id="back">${arrowLeft()} ${idx === 0 ? "Introduction" : "Back"}</button>
            <button class="btn btn-ghost btn-small" id="saveexit" type="button">Save and exit</button>
            <button class="btn btn-primary" id="next">${isLast ? "See results" : "Next"} ${arrowRight()}</button>
          </div>
        </article>
      </section>
    `);

    const nextBtn = document.getElementById("next");
    const evidence = document.getElementById("evidence");

    function nextLabel() {
      const nowVis = visibleQuestions(state.answers);
      const nowLast = nowVis.findIndex((x) => x.id === q.id) === nowVis.length - 1;
      const raw = state.answers[q.id];
      const empty = raw == null || raw === "" || raw === SKIP || (Array.isArray(raw) && !raw.length);
      return (q.optional && empty ? "Skip" : nowLast ? "See results" : "Next") + " " + arrowRight();
    }
    function canAdvance() {
      if (q.optional) {
        if (isText(q)) return textValid(q, state.answers[q.id] || "");
        return true;
      }
      return isAnswered(q, state.answers);
    }
    function refresh() {
      nextBtn.disabled = !canAdvance();
      nextBtn.innerHTML = nextLabel();
      if (evidence) {
        const r = scoreQuestion(q, state.answers);
        evidence.hidden = !(r && r.status === "scored");
      }
    }
    function stamp() { state.times = state.times || {}; state.times[q.id] = new Date().toISOString(); }

    if (isText(q)) {
      const input = document.getElementById("tinput");
      const err = document.getElementById("terr");
      const onInput = () => {
        state.answers[q.id] = input.value;
        stamp();
        const v = input.value.trim();
        const bad = v && !textValid(q, v);
        err.textContent = bad ? (q.type === "email" ? "Enter a valid email address, or leave it empty." : q.type === "url" ? "Enter a valid web address, or leave it empty." : "") : "";
        input.setAttribute("aria-invalid", bad ? "true" : "false");
        persist();
        refresh();
      };
      input.addEventListener("input", onInput);
      input.addEventListener("change", onInput);
      setTimeout(() => input.focus(), 0);
    } else {
      const fs = app.querySelector(".options");
      const writeMulti = (sel, na) => { state.answers[q.id] = sel.concat(na.map((x) => "~" + x)); };
      const sync = () => {
        const cur = getAnswer(q, state.answers);
        fs.querySelectorAll(".option-row").forEach((row) => {
          const id = row.dataset.id;
          const input = row.querySelector("input");
          input.checked = multi ? !!cur && cur.sel.includes(id) : cur === id;
          row.querySelector(".option").classList.toggle("checked", input.checked);
          const isNA = multi && !!cur && cur.na.includes(id);
          row.classList.toggle("is-na", isNA);
          const btn = row.querySelector(".na-toggle");
          if (btn) btn.setAttribute("aria-pressed", isNA ? "true" : "false");
        });
        stamp();
        persist();
        refresh();
      };

      fs.addEventListener("change", (e) => {
        const opt = opts.find((o) => o.id === e.target.value);
        if (!multi) {
          state.answers[q.id] = opt.id;
          return sync();
        }
        const cur = getAnswer(q, state.answers) || { sel: [], na: [] };
        let sel = cur.sel.slice(), na = cur.na.slice();
        if (e.target.checked) {
          if (opt.exclusive) {
            sel = [opt.id];
            if (opt.unsure || opt.na) na = []; // "Not sure" / "Not applicable" replace everything
          } else {
            sel = sel.filter((id) => !opts.find((o) => o.id === id).exclusive).concat(opt.id);
            na = na.filter((id) => id !== opt.id);
          }
        } else {
          sel = sel.filter((id) => id !== opt.id);
        }
        writeMulti(sel, na);
        sync();
      });

      fs.addEventListener("click", (e) => {
        const btn = e.target.closest(".na-toggle");
        if (!btn) return;
        e.preventDefault();
        const id = btn.dataset.id;
        const cur = getAnswer(q, state.answers) || { sel: [], na: [] };
        let sel = cur.sel.slice(), na = cur.na.slice();
        if (na.includes(id)) na = na.filter((x) => x !== id);
        else {
          na.push(id);
          sel = sel.filter((x) => x !== id && !opts.find((o) => o.id === x && (o.unsure || o.na || o.all)));
        }
        writeMulti(sel, na);
        sync();
      });
    }

    const enote = document.getElementById("enote");
    if (enote) enote.addEventListener("input", () => {
      state.notes = state.notes || {};
      const v = enote.value;
      if (v.trim()) state.notes[q.id] = v; else delete state.notes[q.id];
      persist();
    });

    refresh();

    document.getElementById("back").addEventListener("click", () => {
      if (idx === 0) return viewIntro();
      state.current = vis[idx - 1].id;
      persist();
      viewQuestion();
    });
    document.getElementById("saveexit").addEventListener("click", () => {
      persist();
      viewIntro();
    });
    nextBtn.addEventListener("click", goNext);
    app.querySelector(".qcard").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.target.matches("button, textarea, select, summary")) { e.preventDefault(); goNext(); }
    });
    app.querySelector(".stepper").addEventListener("click", (e) => {
      const b = e.target.closest(".step-btn");
      if (!b || b.disabled) return;
      const target = firstVisibleIn(DATA.chapters[Number(b.dataset.ch)], visibleQuestions(state.answers));
      if (!target) return;
      state.current = target.id;
      persist();
      viewQuestion();
    });

    function goNext() {
      if (!canAdvance()) return;
      if (q.optional && state.answers[q.id] == null) state.answers[q.id] = isText(q) ? "" : SKIP;
      const nowVis = visibleQuestions(state.answers);
      const i = nowVis.findIndex((x) => x.id === q.id);
      if (i === nowVis.length - 1) {
        state.date = new Date().toISOString().slice(0, 10);
        state.completed = true;
        persist();
        viewResults();
        return;
      }
      const nxt = nowVis[i + 1];
      state.current = nxt.id;
      persist();
      if (q.chapter.scope && !nxt.chapter.scope) return viewScreening();
      viewQuestion();
    }
  }

  function firstVisibleIn(ch, vis) { return vis.find((x) => x.chapter === ch) || null; }

  function textInputHtml(q, v) {
    v = v == null ? "" : v;
    const ml = q.maxLength ? ` maxlength="${q.maxLength}"` : "";
    const ph = q.placeholder ? ` placeholder="${esc(q.placeholder)}"` : "";
    let input;
    if (q.type === "longtext") {
      input = `<textarea id="tinput" class="text-input" rows="7"${ml}${ph} aria-labelledby="qtext">${esc(v)}</textarea>`;
    } else if (q.type === "country") {
      input = `<select id="tinput" class="text-input" aria-labelledby="qtext">
        <option value="">Select a country</option>
        ${COUNTRIES.map((c) => `<option value="${esc(c)}" ${c === v ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>`;
    } else {
      const type = q.type === "email" ? "email" : "text";
      const extra = q.type === "url" ? ` inputmode="url" autocomplete="url"` : q.type === "email" ? ` autocomplete="email"` : "";
      input = `<input id="tinput" class="text-input" type="${type}" value="${esc(v)}"${ml}${ph}${extra} aria-labelledby="qtext" />`;
    }
    return `<div class="text-field">${input}<p class="field-error" id="terr" role="alert"></p></div>`;
  }

  // Screening result (shown between the profile and Part A) ------------------
  function viewScreening() {
    const sc = screening(state.answers);
    state.screeningSeen = true;
    persist();
    render(`
      <section class="quiz">
        <article class="qcard screening">
          <p class="qmeta">Applicability screening · indicative</p>
          <span class="badge tone-${sc.tone}">Outcome ${sc.outcome}</span>
          <h2 class="qtext" style="margin-top:14px">${esc(sc.title)}</h2>
          <p class="screen-text">${esc(sc.text)}</p>
          <ul class="screen-reasons">${sc.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
          ${sc.conflicts.length ? `<div class="note"><p class="note-title">Answers that point in different directions</p>${sc.conflicts.map((c) => `<p>${esc(c)}</p>`).join("")}</div>` : ""}
          ${sc.dates.length ? `<div class="note"><p class="note-title">When obligations apply</p>${sc.dates.map((d) => `<p>${esc(d)}</p>`).join("")}<p class="small-muted">${esc(S.commencement.note)}</p></div>` : ""}
          ${sc.notes.length ? `<ul class="screen-notes">${sc.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
          <p class="si-notice" role="note">${esc(S.screeningDisclaimer)}</p>
          <div class="qnav">
            <button class="btn btn-ghost" id="back">${arrowLeft()} Back to profile</button>
            <button class="btn btn-primary" id="cont">${sc.outcome === "A" ? "Continue to Part A" : "Continue as a voluntary assessment"} ${arrowRight()}</button>
          </div>
        </article>
      </section>`);
    document.getElementById("back").addEventListener("click", () => {
      const vis = visibleQuestions(state.answers).filter((x) => x.chapter.scope);
      state.current = vis[vis.length - 1].id;
      viewQuestion();
    });
    document.getElementById("cont").addEventListener("click", () => {
      const first = visibleQuestions(state.answers).find((x) => !x.chapter.scope);
      state.current = first.id;
      persist();
      viewQuestion();
    });
  }

  // Results ----------------------------------------------------------------
  function viewResults(opts) {
    opts = opts || {};
    const R = overallResult(state.answers);
    const sc = screening(state.answers);
    const hash = "#r=" + encodeResult();
    try { history.replaceState(null, "", hash); } catch (e) { location.hash = hash; }

    const ctxIds = [S.roleQuestion, "P13A", "7.ADD01"];
    const context = [`<span><span class="ctx-k">Applicability</span> ${esc(sc.short)}</span>`]
      .concat(ctxIds.map((id) => {
        const q = BY_ID[id];
        if (!q || !isVisible(q, state.answers)) return "";
        const o = effOptions(q, state.answers).find((x) => x.id === getAnswer(q, state.answers));
        return o ? `<span><span class="ctx-k">${esc(q.topic)}</span> ${esc(o.label || o.text)}</span>` : "";
      }))
      .filter(Boolean)
      .join("");

    const notes = [];
    if (sc.outcome !== "A")
      notes.push({ title: sc.outcome === "B" ? "Voluntary assessment" : "Indicative — applicability unconfirmed", text: sc.text });
    if (isDeployerOnly(state.answers))
      notes.push({
        title: "Assessed as a deployer",
        text: `${S.standardShort} is written mainly for providers. Activities controlled by your AI system's provider are treated as not applicable rather than as gaps.`
      });
    (S.coverageNotes || []).forEach((n) => { if (condMet(n.showIf, state.answers)) notes.push(n); });
    const notesHtml = notes.length
      ? `<div class="notes">${notes
          .map((n) => `<div class="note"><p class="note-title">${esc(n.title)}${n.ref && S.showClauseRefsInResults ? `<span class="ref">${esc(S.refPrefixShort + n.ref)}</span>` : ""}</p><p>${esc(n.text)}</p></div>`)
          .join("")}</div>`
      : "";

    const answersList = visibleQuestions(state.answers)
      .filter((q) => isAnswered(q, state.answers) && !q.personal)
      .map((q) => {
        const nt = state.notes && state.notes[q.id];
        if (isText(q)) {
          const v = getAnswer(q, state.answers);
          if (!v) return "";
          return `<li><p class="ans-q">${esc(q.text)}</p><ul class="ans-a"><li class="ans-free">${esc(v)}</li></ul></li>`;
        }
        const a = getAnswer(q, state.answers);
        if (a == null) return "";
        const eo = effOptions(q, state.answers);
        const ids = q.type === "multi" ? a.sel : [a];
        const texts = eo.filter((o) => ids.includes(o.id)).map((o) => `<li>${esc(o.text)}</li>`);
        if (q.type === "multi" && a.na.length)
          texts.push(`<li class="ans-na">Marked not applicable: ${esc(eo.filter((o) => a.na.includes(o.id)).map((o) => o.text).join("; "))}</li>`);
        if (nt) texts.push(`<li class="ans-note">Evidence note: ${esc(nt)}</li>`);
        return `<li><p class="ans-q">${esc(q.text)}</p><ul class="ans-a">${texts.join("")}</ul></li>`;
      })
      .join("");

    const bandLabel = R.insufficient ? "Not enough verified answers" : R.maturity.label + (R.provisional ? " · provisional" : "");
    const title = state.label || (!viewingShared && companyName()) || "Your results";
    const sys = !viewingShared && systemDesc();

    const byPart = ["A", "B", "C"].map((p) => {
      const cs = R.chapters.filter((c) => c.ch.part === p);
      if (!cs.length) return "";
      const P = (S.parts || {})[p] || { title: "Part " + p };
      return `<h3 class="part-title results-part">${esc(P.title)}</h3><div class="chapters">${cs.map(chapterCard).join("")}</div>`;
    }).join("");

    render(`
      <section class="results">
        ${viewingShared ? `
          <div class="shared-banner">
            <span>You're viewing a shared result.</span>
            <button class="btn btn-small btn-primary" id="take">Take the assessment yourself</button>
          </div>` : ""}
        ${opts.versionNote ? `<div class="notice">This link was created with an earlier version of the assessment. Some answers may have changed meaning or been removed.</div>` : ""}

        <header class="results-head">
          <div>
            <p class="eyebrow">Assessment report${state.date ? " · " + esc(formatDate(state.date)) : ""}</p>
            <h1>${esc(title)}</h1>
            <p class="lead small">Against selected requirements of ${esc(S.standard)}.</p>
            ${context ? `<p class="ctx">${context}</p>` : ""}
            ${sys ? `<p class="report-system"><span>AI system assessed</span>${esc(truncate(sys, 400))}</p>` : ""}
          </div>
          <div class="results-actions no-print">
            <button class="btn btn-primary" id="share">${shareIcon()} Share results</button>
            <button class="btn btn-secondary" id="print">${downloadIcon()} Save as PDF</button>
            ${viewingShared ? "" : `<button class="btn btn-secondary" id="export">${downloadIcon()} Export JSON</button>`}
            ${viewingShared ? "" : `<button class="btn btn-ghost" id="edit">Edit answers</button>`}
            <button class="btn btn-ghost" id="retake">${retakeIcon()} Retake</button>
          </div>
        </header>
        <p class="toast" id="toast" role="status" aria-live="polite"></p>

        <div class="summary">
          <div class="summary-ring">
            ${ringSvg(R.insufficient ? 0 : R.avg / 3)}
            <div class="ring-label">
              <span class="ring-value">${R.insufficient ? "–" : Math.round((R.avg / 3) * 100)}</span>
              <span class="ring-unit">maturity index</span>
            </div>
          </div>
          <div class="summary-body">
            <span class="badge tone-${R.insufficient ? "none" : R.maturity.tone}">${esc(bandLabel)}</span>
            <p class="summary-text">${summarySentence(R)}</p>
            ${compositionBar(R)}
          </div>
        </div>

        ${notesHtml}
        <div class="note report-disclaimer"><p>${esc(S.reportDisclaimer)}</p></div>

        <h2 class="section-title">Summary by chapter</h2>
        ${summaryTable(R)}

        <h2 class="section-title">By chapter</h2>
        ${byPart}

        ${safetySection(state.answers)}

        <details class="answers">
          <summary>Your answers</summary>
          <ol>${answersList}</ol>
        </details>

        <section class="method">
          <h2 class="section-title">How to read this report</h2>
          <p><strong>Requirements met</strong> counts applicable required ("shall") controls where your answer reflects a documented, implemented
            practice. For "select all" questions this means every applicable item is covered — items marked N/A are left out of
            the calculation. <strong>Maturity index</strong> averages your verified answers on a 0–3 scale, with each chapter weighted equally.
            Where you said a process doesn't exist, its detailed requirements weren't asked and count as unmet.</p>
          <p><strong>Recommended</strong> ("should") and <strong>optional</strong> ("may") practices are listed separately and never count as
            compliance failures. <strong>Not verified</strong> ("Not sure") and <strong>not applicable</strong> answers are kept out of the score.
            Questions that didn't apply to your situation are listed with the reason they were skipped.</p>
          <p class="disclaimer">Indicative self-assessment only. A good result is not certification, conformity, or proof that an AI system is safe.
            Not a conformity assessment, audit or legal advice. Clause references follow the final draft text (FprEN 18286:2026)
            and should be checked against the published edition.</p>
        </section>
      </section>
      ${dialogsHtml()}
    `);

    const take = document.getElementById("take");
    if (take) take.addEventListener("click", () => { state = newState(""); viewIntro(); });

    document.getElementById("share").addEventListener("click", () => openDialog("dlg-share"));
    document.getElementById("print").addEventListener("click", () => window.print());
    const exp = document.getElementById("export");
    if (exp) exp.addEventListener("click", () => openDialog("dlg-export"));
    const edit = document.getElementById("edit");
    if (edit) edit.addEventListener("click", () => {
      state.completed = false;
      clearHash();
      state.current = visibleQuestions(state.answers)[0].id;
      persist();
      viewQuestion();
    });
    document.getElementById("retake").addEventListener("click", () => {
      if (!viewingShared && !confirm("Start a new assessment? Your current answers will be cleared from this browser (any link you've shared keeps working).")) return;
      store.clear();
      state = newState(state.label);
      state.current = ALL[0].id;
      viewingShared = false;
      clearHash();
      persist();
      viewQuestion();
    });
    wireDialogs();
  }

  function dialogsHtml() {
    return `
      <dialog class="dlg" id="dlg-share" aria-labelledby="dlg-share-t">
        <h2 id="dlg-share-t">Share results</h2>
        <p>The link contains your multiple-choice answers${state.label ? " and your assessment label" : ""}. It does not contain your
          company profile text, contact details, AI system description or evidence notes.</p>
        <p><strong>Anyone with the link can view these results.</strong></p>
        <label class="check"><input type="checkbox" id="share-ok" /> I understand and want to create a share link.</label>
        <div class="dlg-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="share-go" disabled>Copy link</button>
        </div>
      </dialog>
      <dialog class="dlg" id="dlg-export" aria-labelledby="dlg-export-t">
        <h2 id="dlg-export-t">Export answers as JSON</h2>
        <p>The file is saved to your device. It contains your answers with clause references, timestamps and evidence notes,
          your company profile and the AI system description.</p>
        <label class="check"><input type="checkbox" id="export-contact" /> Include contact details (name, position, email). These are personal data.</label>
        <label class="check"><input type="checkbox" id="export-ok" /> I understand what the file contains and want to download it.</label>
        <div class="dlg-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="export-go" disabled>Download JSON</button>
        </div>
      </dialog>`;
  }

  function openDialog(id) {
    const d = document.getElementById(id);
    if (!d) return;
    d.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
    d.querySelectorAll(".dlg-actions .btn-primary").forEach((b) => (b.disabled = true));
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  function closeDialog(d) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }

  function wireDialogs() {
    document.querySelectorAll(".dlg [data-close]").forEach((b) => b.addEventListener("click", () => closeDialog(b.closest("dialog"))));
    const shareOk = document.getElementById("share-ok"), shareGo = document.getElementById("share-go");
    shareOk.addEventListener("change", () => (shareGo.disabled = !shareOk.checked));
    shareGo.addEventListener("click", async () => {
      closeDialog(document.getElementById("dlg-share"));
      const url = shareUrl();
      const title = (state.label ? state.label + " — " : "") + S.siteName;
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        try { await navigator.share({ title, url }); return; } catch (e) { /* fall back to copy */ }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied. Anyone with it can view these results.");
      } catch (e) {
        window.prompt("Copy this link to share your results:", url);
      }
    });
    const expOk = document.getElementById("export-ok"), expGo = document.getElementById("export-go");
    if (expOk) {
      expOk.addEventListener("change", () => (expGo.disabled = !expOk.checked));
      expGo.addEventListener("click", () => {
        const withContact = document.getElementById("export-contact").checked;
        closeDialog(document.getElementById("dlg-export"));
        downloadJson(buildExport(state.answers, { withContact }));
        toast("JSON file downloaded.");
      });
    }
  }

  // JSON export ------------------------------------------------------------
  function buildExport(answers, o) {
    o = o || {};
    const sc = screening(answers);
    const ids = state.ids || { company: makeId("company"), system: makeId("system") };
    const txt = (id) => (typeof answers[id] === "string" && answers[id].trim()) || null;
    const optLabel = (id) => {
      const q = BY_ID[id];
      const a = q && getAnswer(q, answers);
      const opt = a && effOptions(q, answers).find((x) => x.id === a);
      return opt ? opt.label || opt.text : null;
    };
    const chapterById = {};
    const results = overallResult(answers);
    results.chapters.forEach((c) => (chapterById[c.ch.id] = c));

    const records = [];
    ALL.forEach((q) => {
      if (q.personal) return;
      const ch = q.chapter;
      const sysLevel = ch.part === "C";
      const rec = {
        question_id: q.id,
        chapter: ch.scope ? "profile" : ASSESSED.indexOf(ch) + 1,
        part: ch.part || null,
        company_id: sysLevel ? null : ids.company,
        system_id: sysLevel ? ids.system : null,
        question: q.text,
        selected_option_ids: [],
        answer_text: null,
        status: null,
        applicability_reason: null,
        source_clause: sourceText(q) || null,
        normative_label: q.role === "readiness" ? "readiness" : normOf(q) === "required" ? "required" : normOf(q) === "context" ? "context/screening" : normOf(q),
        timestamp: (state.times && state.times[q.id]) || null,
        evidence_note: (state.notes && state.notes[q.id]) || null
      };
      if (!isVisible(q, answers)) {
        if (q.role) return; // unasked context/readiness questions aren't records
        const cr = chapterById[ch.id];
        if (cr && cr.notApplicable) { rec.status = "not_applicable"; rec.applicability_reason = cr.naReason; }
        else {
          const why = whyHidden(q, answers);
          if (why.kind === "gated") { rec.status = "missing"; rec.applicability_reason = `Not asked: no process in place (${why.gate.id} ${why.gate.topic}).`; }
          else { rec.status = "not_applicable"; rec.applicability_reason = why.reason; }
        }
        rec.evidence_note = null;
        records.push(rec);
        return;
      }
      if (isText(q)) {
        rec.answer_text = txt(q.id);
        rec.status = rec.answer_text ? "answered" : "skipped";
        records.push(rec);
        return;
      }
      const a = getAnswer(q, answers);
      if (q.optional && answers[q.id] === SKIP) { rec.status = "skipped"; records.push(rec); return; }
      if (a == null) { rec.status = "unanswered"; records.push(rec); return; }
      const eff = effOptions(q, answers);
      rec.selected_option_ids = q.type === "multi" ? a.sel.slice() : [a];
      if (q.type === "multi" && a.na.length) rec.items_marked_not_applicable = a.na.slice();
      rec.answer_text = eff.filter((x) => rec.selected_option_ids.includes(x.id)).map((x) => x.text).join("; ");
      if (q.role === "context") rec.status = "answered";
      else if (q.role === "readiness") {
        const opt = eff.find((x) => x.id === a);
        rec.status = "readiness: " + (opt && opt.readiness ? opt.readiness : "answered");
      } else {
        const r = scoreQuestion(q, answers);
        if (!r) rec.status = "unanswered";
        else if (r.status === "na") { rec.status = "not_applicable"; rec.applicability_reason = r.answerText[0] || "Marked not applicable."; }
        else if (r.status === "unsure") rec.status = "unknown";
        else rec.status = r.score >= 3 - 1e-9 ? "implemented" : r.score === 0 ? "missing" : "partial";
        if (r && r.missing && r.missing.length) rec.items_not_covered = r.missing;
      }
      records.push(rec);
    });

    const out = {
      tool: S.siteName,
      assessment_version: DATA.version,
      standard: S.standard,
      clause_references: "FprEN 18286:2026 final draft — check against the published edition",
      exported_at: new Date().toISOString(),
      completed_on: state.date || null,
      label: state.label || null,
      company_id: ids.company,
      system_id: ids.system,
      applicability: { outcome: sc.outcome, title: sc.title, reasons: sc.reasons, notes: sc.notes, conflicts: sc.conflicts, commencement: sc.dates },
      company_profile: {
        legal_entity_name: txt("P01"), website: txt("P02"), country: txt("P03"),
        main_industry: optLabel("P04"), employees: optLabel("P05")
      },
      ai_system: { system_id: ids.system, description: txt(S.systemDescriptionQuestion), lifecycle_stage: optLabel("P13A") },
      summary: results.chapters.map((c) => ({
        chapter: ASSESSED.indexOf(c.ch) + 1, title: c.ch.title, part: c.ch.part,
        not_applicable: !!c.notApplicable, required_controls: c.total, implemented: c.met, partial: c.partial,
        missing: c.missing, unknown: c.unsure, not_applicable_answers: c.na, recommended_items: c.recs.length
      })),
      records,
      disclaimer: S.screeningDisclaimer
    };
    if (o.withContact) out.company_profile.contact = { name: txt("P06"), position: txt("P07"), email: txt("P08") };
    return out;
  }

  function downloadJson(obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (state.label || companyName() || "assessment").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "assessment";
    a.href = url;
    a.download = `en18286-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function summarySentence(R) {
    if (R.insufficient)
      return "Too few answers could be verified to give a score. Start by identifying who owns each of these areas and what evidence exists.";
    const app = R.chapters.filter((c) => !c.notApplicable && c.total > 0);
    const parts = [];
    if (R.met === R.total) parts.push("Every verified requirement is reported as documented and implemented. The next step is making sure the evidence would stand up to an external review.");
    else if (R.avg < 0.75) parts.push("Core quality management processes are largely not yet in place across the areas assessed. The gap list below is a reasonable starting backlog.");
    else if (app.length > 1) {
      const sorted = app.slice().sort((a, b) => a.avg - b.avg);
      const lo = sorted[0], hi = sorted[sorted.length - 1];
      if (hi.avg - lo.avg >= 0.5) parts.push(`Your practices are most developed in <strong>${esc(hi.ch.title)}</strong> and least developed in <strong>${esc(lo.ch.title)}</strong>.`);
      else parts.push("Maturity is fairly even across the areas assessed.");
    }
    if (R.provisional) parts.push(`${R.unsure} of ${R.total + R.unsure} applicable answers couldn't be verified, so treat this score as provisional.`);
    else if (R.unsure) parts.push(`${R.unsure} answer${R.unsure > 1 ? "s" : ""} couldn't be verified and ${R.unsure > 1 ? "are" : "is"} listed separately.`);
    return parts.join(" ");
  }

  function summaryTable(R) {
    const rows = R.chapters.map((c) => {
      const n = ASSESSED.indexOf(c.ch) + 1;
      if (c.notApplicable) return `<tr class="row-na"><td>${n}</td><td>${esc(c.ch.title)}</td><td colspan="6">Not applicable</td></tr>`;
      const recIn = c.recs.filter((x) => x.status === "scored" && x.score >= 3 - 1e-9).length;
      return `<tr><td>${n}</td><td>${esc(c.ch.title)}</td><td>${c.total}</td><td>${c.met}</td><td>${c.partial}</td><td>${c.missing}</td><td>${c.unsure}</td><td>${c.recs.length ? recIn + " / " + c.recs.length : "–"}</td></tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="sumtable">
      <thead><tr><th>#</th><th>Chapter</th><th title="Applicable required controls">Required</th><th>Met</th><th>Partial</th><th>Missing</th><th>Not sure</th><th title="Recommended or optional practices in place">Recommended</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function compositionBar(c) {
    const segs = [
      { k: "met", label: "Met", n: c.met },
      { k: "partial", label: "Partial", n: c.partial },
      { k: "missing", label: "Missing", n: c.missing },
      { k: "unsure", label: "Not verified", n: c.unsure },
      { k: "na", label: "Not applicable", n: c.na }
    ];
    const tot = segs.reduce((s, x) => s + x.n, 0);
    if (!tot) return "";
    return `
      <div class="comp">
        <div class="comp-bar" role="img" aria-label="${esc(segs.filter((s) => s.n).map((s) => s.n + " " + s.label.toLowerCase()).join(", "))}">
          ${segs.filter((s) => s.n).map((s) => `<span class="seg seg-${s.k}" style="flex:${s.n}"></span>`).join("")}
        </div>
        <ul class="comp-legend">
          ${segs.filter((s) => s.n).map((s) => `<li><span class="sw seg-${s.k}"></span>${s.label} <strong>${s.n}</strong></li>`).join("")}
        </ul>
      </div>`;
  }

  function chapterCard(c) {
    const num = ASSESSED.indexOf(c.ch) + 1;
    const heading = `<span class="ch-num">${num}</span>${esc(c.ch.title)}`;
    if (c.notApplicable) {
      return `
        <article class="chapter chapter-na">
          <header class="chapter-head"><h3>${heading}</h3><span class="badge tone-none">Not applicable</span></header>
          <p class="gap-current">${esc(c.naReason)}</p>
        </article>`;
    }
    const maturityPct = Math.round((c.avg / 3) * 100);
    let body = "";
    const gateItems = c.gateGaps.map((g) => `
          <li class="gap">
            <div class="gap-head"><span class="tag tag-missing">Missing</span><span class="gap-topic">${esc(g.gate.topic)}</span>${refTag(g.gate.ref)}</div>
            <p class="gap-current">No established process is in place, so ${g.count === 1 ? "the 1 detailed requirement" : `the ${g.count} detailed requirements`} here ${g.count === 1 ? "was" : "were"} not assessed and count${g.count === 1 ? "s" : ""} as unmet.</p>
            ${g.readiness ? `<p class="readiness"><span>Implementation plan</span><strong>${esc(g.readiness)}</strong></p>` : ""}
          </li>`).join("");
    const gapCount = c.gateGaps.length + c.gaps.length;
    if (gapCount) {
      body = `<p class="gaps-title">Gaps · ${gapCount}</p><ul class="gaps">${gateItems}${c.gaps.map(gapItem).join("")}</ul>`;
    } else if (c.total) {
      body = `<p class="no-gaps">${checkIcon()} No gaps identified in the verified answers.</p>`;
    }

    if (c.unsureItems.length) {
      body += `<p class="gaps-title">Not verified · ${c.unsureItems.length}</p>
        <ul class="gaps side-list">${c.unsureItems
          .map((i) => `<li class="gap"><div class="gap-head"><span class="tag tag-unsure">Not sure</span><span class="gap-topic">${esc(i.q.topic)}</span>${refTag(i.q.ref)}</div>
            <p class="gap-current">Confirm who owns this and what evidence exists.</p></li>`)
          .join("")}</ul>`;
    }
    if (c.readinessList.length) {
      body += `<p class="gaps-title">Readiness · not scored</p>
        <ul class="gaps side-list">${c.readinessList
          .map((x) => `<li class="gap"><div class="gap-head"><span class="tag tag-na">Readiness</span><span class="gap-topic">${esc(x.q.topic)}</span>${refTag(x.q.ref)}</div>
            <p class="gap-current">${esc(x.label || "Not answered")}</p></li>`)
          .join("")}</ul>`;
    }
    if (c.recs.length) {
      body += `<p class="gaps-title">Recommended and optional practices · not scored</p>
        <ul class="gaps side-list">${c.recs.map(recItem).join("")}</ul>`;
    }
    if (c.naList.length) {
      body += `<p class="gaps-title">Marked not applicable</p>
        <ul class="gaps side-list">${c.naList
          .map((n) => `<li class="gap"><div class="gap-head"><span class="tag tag-na">N/A</span><span class="gap-topic">${esc(n.q.topic)}</span>${refTag(n.q.ref)}</div>
            <p class="gap-current">${n.whole && n.answerText.length ? esc(n.answerText[0]) : "Marked not applicable: " + esc(n.items.join("; "))}</p></li>`)
          .join("")}</ul>`;
    }
    if (c.skipped.length) {
      body += `<details class="skipped"><summary>Not asked · ${c.skipped.length} — didn't apply to your situation</summary>
        <ul class="gaps side-list">${c.skipped
          .map((s) => `<li class="gap"><div class="gap-head"><span class="tag tag-na">Skipped</span><span class="gap-topic">${esc(s.q.topic)}</span>${refTag(s.q.ref)}</div>
            <p class="gap-current">${esc(s.reason)}</p></li>`)
          .join("")}</ul></details>`;
    }

    const band = c.nothingApplies
      ? `<span class="badge tone-none">No applicable requirements</span>`
      : c.insufficient
      ? `<span class="badge tone-none">Not verified</span>`
      : `<span class="badge tone-${c.maturity.tone}">${esc(c.maturity.label)}${c.provisional ? " · provisional" : ""}</span>`;

    return `
      <article class="chapter">
        <header class="chapter-head"><h3>${heading}</h3>${band}</header>
        ${c.nothingApplies ? "" : `<div class="chapter-metrics">
          <div class="metric">
            <div class="metric-top"><span>Requirements met</span><strong>${c.met} / ${c.total}</strong></div>
            ${compositionBar(c).replace('class="comp"', 'class="comp comp-compact"')}
          </div>
          <div class="metric">
            <div class="metric-top"><span>Maturity index</span><strong>${c.insufficient ? "–" : maturityPct}</strong></div>
            <div class="bar bar-soft"><span style="width:${c.insufficient ? 0 : maturityPct}%"></span></div>
          </div>
        </div>`}
        ${body}
      </article>`;
  }

  function recItem(x) {
    let tag, text;
    if (x.status === "unsure") { tag = `<span class="tag tag-unsure">Not sure</span>`; text = "Confirm whether this is in place."; }
    else if (x.status === "na") { tag = `<span class="tag tag-na">N/A</span>`; text = x.answerText[0] || ""; }
    else if (x.score >= 3 - 1e-9) { tag = `<span class="tag tag-partial">In place</span>`; text = x.answerText.join("; "); }
    else if (x.missing && x.hit) { tag = `<span class="tag tag-informal">Partly</span>`; text = `${x.hit} of ${x.of} covered. Not yet: ${x.missing.join("; ")}`; }
    else { tag = `<span class="tag tag-informal">Not in place</span>`; text = "Consider adopting this practice."; }
    const lbl = normOf(x.q) === "optional" ? "Optional" : "Recommended";
    return `<li class="gap"><div class="gap-head">${tag}<span class="tag tag-key">${lbl}</span><span class="gap-topic">${esc(x.q.topic)}</span>${refTag(x.q.ref)}</div>
      <p class="gap-current">${esc(text)}</p></li>`;
  }

  function gapItem(g) {
    let detail;
    if (g.missing) {
      detail = `<p class="gap-current">${g.hit} of ${g.of} applicable items covered. Not yet covered:</p>
        <ul class="missing">${g.missing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`;
    } else {
      detail = `
        <p class="gap-current"><span class="k">Now</span>${esc(g.answerText[0])}</p>
        ${g.target ? `<p class="gap-target"><span class="k">Target</span>${esc(g.target)}</p>` : ""}`;
    }
    const key = g.q.key ? `<p class="key-note">${esc(g.q.keyNote || "Explicitly required by the standard.")}</p>` : "";
    return `
      <li class="gap ${g.q.key ? "is-key" : ""}">
        <div class="gap-head"><span class="tag tag-${g.sev.key}">${g.sev.label}</span>${g.q.key ? `<span class="tag tag-key">Explicit requirement</span>` : ""}<span class="gap-topic">${esc(g.q.topic)}</span>${refTag(g.q.ref)}</div>
        ${detail}${key}
      </li>`;
  }

  function refTag(ref) {
    if (!S.showClauseRefsInResults || !ref) return "";
    return `<span class="ref">${esc((S.refPrefixShort || "") + ref.split(";")[0].trim())}</span>`;
  }

  // ---------- AI Safety Indicator -------------------------------------------
  // Mappings, weights and texts live in assets/js/safety-config.js.
  // Internal values are computed here only to pick a level and an order;
  // they are never written to the page. Unchanged by the v3 extension: new
  // questions are not tagged, so they don't affect it.
  const SAFE = window.SAFETY && window.SAFETY.enabled !== false ? window.SAFETY : null;

  const fill = (tpl, vals) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vals[k] != null ? vals[k] : m));
  const lcFirst = (s) => (s && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const stripDot = (s) => String(s).replace(/\.\s*$/, "");

  function parseTag(key) {
    const m = String(key).match(/^([\d.]+?)([A-Z]+)?$/);
    if (!m) return null;
    // "8.1" vs "8.10": prefer an exact question id
    if (BY_ID[key]) return { qid: key, opt: null };
    return BY_ID[m[1]] ? { qid: m[1], opt: m[2] || null } : null;
  }

  // Evidence for one tagged question within one topic.
  // Returns { status: "excluded" | "unknown" | "evidence", items: [{ opt, weight, maturity }], inferred }
  function safetyEvidence(q, optTags, answers) {
    const dep = isDeployerOnly(answers);
    if (dep && q.providerOnly) return { status: "excluded" };
    const eff = effOptions(q, answers);
    const applicableOpts = (tags) => tags.filter((t) => eff.some((o) => o.id === t.opt));

    if (!isVisible(q, answers)) {
      // Skipped because the area's process gate said "no process": count as absent.
      const cr = chapterResult(q.chapter, answers);
      if (q.role || !cr.gatedIds || !cr.gatedIds.has(q.id)) return { status: "excluded" };
      const tags = q.type === "multi" ? applicableOpts(optTags) : optTags;
      if (!tags.length) return { status: "excluded" };
      return { status: "evidence", inferred: true, items: tags.map((t) => ({ opt: t.opt, weight: t.weight, maturity: 0 })) };
    }

    const a = getAnswer(q, answers);
    if (q.type === "single") {
      const o = eff.find((x) => x.id === a);
      if (!o || o.na) return { status: "excluded" };
      if (o.unsure) return { status: "unknown" };
      if (typeof o.score !== "number") return { status: "excluded" };
      return { status: "evidence", answer: o, items: optTags.map((t) => ({ opt: null, weight: t.weight, maturity: o.score / 3 })) };
    }
    if (!a) return { status: "excluded" };
    const chosen = eff.filter((o) => a.sel.includes(o.id));
    if (chosen.some((o) => o.na)) return { status: "excluded" };
    if (chosen.some((o) => o.unsure)) return { status: "unknown" };
    const tags = applicableOpts(optTags).filter((t) => !a.na.includes(t.opt));
    if (!tags.length) return { status: "excluded" };
    return { status: "evidence", items: tags.map((t) => ({ opt: t.opt, weight: t.weight, maturity: a.sel.includes(t.opt) ? 1 : 0 })) };
  }

  function safetyTopic(topic, answers) {
    // Group the topic's tags by question
    const byQ = {};
    Object.keys(topic.tags || {}).forEach((key) => {
      const p = parseTag(key);
      const w = Number(topic.tags[key]);
      if (!p || !(w > 0)) return;
      (byQ[p.qid] = byQ[p.qid] || []).push({ opt: p.opt, weight: w });
    });

    let sumW = 0, sumWM = 0;
    const lines = [], unknowns = [], qIds = new Set();
    let inferred = 0;

    Object.keys(byQ).forEach((qid) => {
      const q = BY_ID[qid];
      if (!q) return;
      const ev = safetyEvidence(q, byQ[qid], answers);
      if (ev.status === "unknown") { unknowns.push(q); return; }
      if (ev.status !== "evidence") return;
      qIds.add(qid);
      if (ev.inferred) inferred++;
      ev.items.forEach((it) => { sumW += it.weight; sumWM += it.weight * it.maturity; });

      if (ev.inferred) {
        const w = Math.max.apply(null, ev.items.map((i) => i.weight));
        lines.push({ q, weight: w, maturity: 0, low: true, text: fill(SAFE.texts.skipped, { label: safetyLabel(q) }) });
      } else if (q.type === "single") {
        const m = ev.items[0].maturity;
        lines.push({ q, weight: ev.items[0].weight, maturity: m, low: m < 0.5, text: "“" + lcFirst(stripDot(ev.answer.text)) + "”" });
      } else {
        const ph = (SAFE.phrases || {})[qid] || { missing: "“{option}” is not covered", has: "“{option}” is covered" };
        ev.items.forEach((it) => {
          const opt = q.options.find((o) => o.id === it.opt);
          const vals = { option: opt.text, option_lc: lcFirst(opt.text) };
          lines.push({ q, weight: it.weight, maturity: it.maturity, low: it.maturity < 0.5, text: fill(it.maturity ? ph.has : ph.missing, vals) });
        });
      }
    });

    const n = qIds.size;
    const res = { topic, n, inferred, unknowns, lines, limited: n > 0 && n < (SAFE.minQuestions || 2) };
    if (n === 0 || sumW === 0) return Object.assign(res, { level: null });
    const value = Math.round(100 * (1 - sumWM / sumW)); // internal only
    const level = SAFE.levels.find((l) => value <= l.max) || SAFE.levels[SAFE.levels.length - 1];
    return Object.assign(res, { level, _v: value, _w: sumW });
  }

  function safetyLabel(q) {
    return ((SAFE && SAFE.labels) || {})[q.id] || q.topic;
  }

  function safetyResults(answers) {
    const list = SAFE.topics.map((t) => safetyTopic(t, answers));
    // Strongest indication first; ties keep config order. No-indication topics last.
    return list
      .map((r, i) => ({ r, i }))
      .sort((a, b) => {
        const av = a.r.level ? a.r._v : -1, bv = b.r.level ? b.r._v : -1;
        return bv - av || a.i - b.i;
      })
      .map((x) => x.r);
  }

  function safetySection(answers) {
    if (!SAFE) return "";
    const T = SAFE.texts;
    const list = safetyResults(answers);
    const ranked = list.filter((r) => r.level);

    // Only name topics that genuinely stand out: ties are never broken arbitrarily.
    let summary;
    const nm = (r) => `<strong>${esc(r.topic.title)}</strong>`;
    if (!ranked.length) summary = T.summaryNone;
    else {
      const allLower = ranked[0].level === SAFE.levels[0];
      const top = ranked.filter((r) => r._v === ranked[0]._v);
      let pick;
      if (top.length === ranked.length && ranked.length > 1) pick = null;
      else if (top.length > 3) pick = "many";
      else if (top.length >= 2) pick = top;
      else if (ranked.length >= 2 && (ranked.length === 2 || ranked[1]._v !== ranked[2]._v)) pick = ranked.slice(0, 2);
      else pick = ranked.slice(0, 1);

      if (!pick) summary = fill(T.summaryEven, { level: esc(ranked[0].level.label.toLowerCase()) });
      else if (pick === "many") summary = fill(T.summaryManyTied, { level: esc(ranked[0].level.label.toLowerCase()) });
      else if (pick.length === 1) summary = fill(allLower ? T.summaryOneLower : T.summaryOne, { 1: nm(pick[0]) });
      else if (pick.length === 2) summary = fill(allLower ? T.summaryAllLower : T.summaryTwo, { 1: nm(pick[0]), 2: nm(pick[1]) });
      else {
        const list = pick.slice(0, -1).map(nm).join(", ") + " and " + nm(pick[pick.length - 1]);
        summary = fill(allLower ? T.summaryManyLower : T.summaryMany, { list });
      }
    }

    const segs = (lvl) => {
      const k = lvl ? lvl.segments : 0;
      let h = "";
      for (let i = 1; i <= SAFE.levels.length; i++) h += `<span class="${i <= k ? "on" : ""}"></span>`;
      return `<span class="si-bar si-l${k}" aria-hidden="true">${h}</span>`;
    };

    const cards = list.map((r) => {
      const low = r.lines.filter((l) => l.low).sort((a, b) => b.weight - a.weight || a.maturity - b.maturity);
      const good = r.lines.filter((l) => !l.low).sort((a, b) => b.weight - a.weight);
      const li = (l) => `<li>${esc(fill(T.indicated, { text: l.text }))}.</li>`;

      // Clauses of the weakest tagged questions
      const refs = [];
      low.slice().sort((a, b) => a.maturity - b.maturity || b.weight - a.weight).forEach((l) => {
        const ref = l.q.ref ? l.q.ref.split(";")[0].trim() : "";
        if (ref && !refs.includes(ref) && refs.length < 3) refs.push(ref);
      });

      const based = r.n === 1 ? T.basedOn.replace("{n}", "1") : fill(T.basedOn, { n: r.n });
      const status = r.level ? esc(r.level.label) : esc(T.noIndication);

      return `
        <details class="si-topic">
          <summary>
            <span class="si-name">${esc(r.topic.title)}</span>
            <span class="si-right">
              ${segs(r.level)}
              <span class="si-level ${r.level ? "" : "si-none"}">${status}</span>
            </span>
            ${r.limited ? `<span class="si-limited">${esc(T.limited)}</span>` : ""}
          </summary>
          <div class="si-body">
            <div class="si-block"><h4>${esc(T.whatItIs)}</h4><p>${esc(r.topic.what)}</p></div>
            ${r.level ? `
            <div class="si-block"><h4>${esc(T.suggests)}</h4>
              ${low.length ? `<ul>${low.map(li).join("")}</ul>` : `<p class="si-muted">${esc(T.suggestsEmpty)}</p>`}</div>
            <div class="si-block"><h4>${esc(T.helps)}</h4>
              ${good.length ? `<ul>${good.map(li).join("")}</ul>` : `<p class="si-muted">${esc(T.helpsEmpty)}</p>`}</div>` : ""}
            ${r.unknowns.length ? `
            <div class="si-block"><h4>${esc(T.unknowns)}</h4>
              <ul>${r.unknowns.map((q) => `<li>${esc(safetyLabel(q))}</li>`).join("")}</ul>
              <p class="si-muted">${esc(T.unknownsNote)}</p></div>` : ""}
            ${refs.length ? `<div class="si-block"><h4>${esc(T.lookNext)}</h4><p>${esc(T.lookNextPrefix)} ${refs.map(esc).join(" · ")}</p></div>` : ""}
            ${r.n ? `<p class="si-based">${esc(based)}${r.inferred ? " " + esc(fill(T.inferred, { m: r.inferred })) : ""}</p>` : ""}
          </div>
        </details>`;
    }).join("");

    const notCovered = (SAFE.notCovered || []).map((x) =>
      `<li><p class="si-nc-title">${esc(x.title)}${x.ref ? ` <span class="si-nc-ref">${esc(x.ref)}</span>` : ""}</p><p>${esc(x.text)}</p></li>`
    ).join("");

    return `
      <section class="safety" id="ai-safety-indicator" aria-labelledby="si-title">
        <h2 class="section-title si-section-title" id="si-title">${esc(SAFE.title)}</h2>
        <div class="si-notice" role="note">${esc(SAFE.notice)}</div>
        <p class="si-summary">${summary}</p>
        <div class="si-scale">
          <span class="si-scale-cap">${esc(SAFE.scaleCaption)}</span>
          <span class="si-scale-ends"><span>${esc(SAFE.levels[0].label.split(" ")[0])}</span>${segs(SAFE.levels[SAFE.levels.length - 1])}<span>${esc(SAFE.levels[SAFE.levels.length - 1].label.split(" ")[0])}</span></span>
        </div>
        <div class="si-list">${cards}</div>
        ${notCovered ? `<div class="si-nc"><h3>${esc(T.notCoveredTitle)}</h3><ul>${notCovered}</ul></div>` : ""}
      </section>`;
  }

  // ---------- Helpers -------------------------------------------------------
  function persist() { if (!viewingShared) store.set(state); }
  function clearHash() {
    if (location.hash) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
    }
  }
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }
  function ringSvg(frac) {
    const r = 52, c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(1, frac)));
    return `<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="${r}" class="ring-track"/>
      <circle cx="60" cy="60" r="${r}" class="ring-fill" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 60 60)" ${frac <= 0 ? 'stroke-opacity="0"' : ""}/>
    </svg>`;
  }
  const svg = (d, w) => `<svg class="icon" viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const checkIcon = () => svg('<path d="M5 12.5l4.2 4.2L19 7"/>', 14);
  const scopeIcon = () => svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>', 13);
  const arrowRight = () => svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const arrowLeft = () => svg('<path d="M19 12H5M11 6l-6 6 6 6"/>');
  const shareIcon = () => svg('<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/>');
  const downloadIcon = () => svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>');
  const retakeIcon = () => svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>');

  window.addEventListener("beforeprint", () => document.querySelectorAll("details").forEach((d) => (d.open = true)));

  const COUNTRIES = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
    "Iceland", "Liechtenstein", "Norway", "Switzerland", "United Kingdom",
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Côte d’Ivoire", "Cuba", "Democratic Republic of the Congo", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Fiji", "Gabon", "Gambia", "Georgia", "Ghana", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "India", "Indonesia", "Iran", "Iraq", "Israel", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Qatar", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Sri Lanka", "Sudan", "Suriname", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe", "Other"];

  // Test hook (no effect unless a test harness sets window.__EN18286_TEST__ first)
  if (window.__EN18286_TEST__) {
    window.__EN18286_TEST__.api = { ALL, BY_ID, chapterResult, overallResult, safetyResults, screening, isVisible, visibleQuestions, whyHidden, buildExport, encodeResult, decodeResult, getState: () => state, setState: (s) => (state = s) };
  }

  // ---------- Boot ----------------------------------------------------------
  function boot() {
    const m = location.hash.match(/^#r=([A-Za-z0-9_-]+)/);
    if (m) {
      const decoded = decodeResult(m[1]);
      if (decoded && Object.keys(decoded.answers).length) {
        const saved = store.get();
        let own = false;
        if (saved && saved.completed) {
          state = saved;
          own = encodeResult() === m[1];
        }
        viewingShared = !own;
        state = own ? saved : Object.assign(newState(decoded.label), { answers: decoded.answers, date: decoded.date });
        viewResults({ versionNote: decoded.version !== DATA.version });
        return;
      }
    }
    const saved = store.get();
    if (saved && saved.completed && saved.answers) {
      state = Object.assign(newState(""), saved);
      viewResults();
      return;
    }
    viewIntro();
  }

  boot();
})();
