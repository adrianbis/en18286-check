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

  // ---------- Index ---------------------------------------------------------
  const ALL = [];
  DATA.chapters.forEach((ch, ci) => {
    ch.questions.forEach((q) => ALL.push(Object.assign({ chapter: ch, chapterIndex: ci }, q)));
  });
  const BY_ID = Object.fromEntries(ALL.map((q) => [q.id, q]));
  const ASSESSED = DATA.chapters.filter((c) => !c.scope);
  const isScored = (q) => !q.role;
  const MAX_QUESTIONS = ALL.filter((q) => q.role !== "readiness").length;

  // ---------- State ---------------------------------------------------------
  let state = { answers: {}, label: "", current: null, date: null };
  let viewingShared = false;

  // ---------- Utilities -----------------------------------------------------
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

  // ---------- Applicability -------------------------------------------------
  function isDeployerOnly(answers) {
    return (S.deployerOnlyAnswers || []).includes(answers[S.roleQuestion]);
  }

  // The options a respondent actually sees, given their role.
  function effOptions(q, answers) {
    const dep = isDeployerOnly(answers);
    const opts = dep ? q.options.filter((o) => !o.providerOnly) : q.options.slice();
    if (dep && q.providerOnly && !opts.some((o) => o.na)) {
      opts.push({ id: "NA", text: q.naText || S.providerNAText, na: true, exclusive: true, auto: true });
    }
    return opts;
  }

  // Normalised answer: single → option id | null; multi → { sel: [...], na: [...] } | null
  function getAnswer(q, answers) {
    const raw = answers[q.id];
    if (raw == null) return null;
    const ids = effOptions(q, answers).map((o) => o.id);
    if (q.type === "single") return ids.includes(raw) ? raw : null;
    const arr = Array.isArray(raw) ? raw : [];
    const sel = arr.filter((x) => x[0] !== "~" && ids.includes(x));
    const na = q.allowItemNA ? arr.filter((x) => x[0] === "~").map((x) => x.slice(1)).filter((x) => ids.includes(x)) : [];
    return { sel, na };
  }

  function isAnswered(q, answers) {
    const a = getAnswer(q, answers);
    if (q.type === "single") return a != null;
    if (!a) return false;
    if (a.sel.length) return true;
    const req = effOptions(q, answers).filter((o) => o.required);
    return a.na.length > 0 && req.every((o) => a.na.includes(o.id));
  }

  // ---------- Branching -----------------------------------------------------
  function condMet(c, answers) {
    if (!c) return true;
    const tq = BY_ID[c.question];
    if (!tq) return true;
    if (!isVisible(tq, answers)) return false;
    const a = getAnswer(tq, answers);
    if (tq.type === "single" && a != null) {
      const o = effOptions(tq, answers).find((x) => x.id === a);
      if (o && o.na) return false; // "Not applicable" skips everything that depends on it
    }
    if (c.is) return a != null && c.is.includes(a);
    if (c.not) return a == null || !c.not.includes(a);
    return true;
  }
  const isVisible = (q, answers) => condMet(q.showIf, answers);
  const visibleQuestions = (answers) => ALL.filter((q) => isVisible(q, answers));

  // ---------- Scoring -------------------------------------------------------
  function scoreQuestion(q, answers) {
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
    const hit = req.filter((o) => a.sel.includes(o.id));
    const missing = req.filter((o) => !a.sel.includes(o.id)).map((o) => o.text);
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
    const entry = qs[0];
    const base = { ch, met: 0, total: 0, avg: 0, partial: 0, missing: 0, unsure: 0, na: 0, gaps: [], unsureItems: [], naList: [] };

    const entryAns = getAnswer(entry, answers);
    const entryOpt = entryAns != null && effOptions(entry, answers).find((o) => o.id === entryAns);
    if (entryOpt && entryOpt.na) {
      return Object.assign(base, { notApplicable: true, naReason: entryOpt.text, maturity: null });
    }

    const readinessQ = qs.find((q) => q.role === "readiness" && isVisible(q, answers));
    let readiness = null;
    if (readinessQ) {
      const o = effOptions(readinessQ, answers).find((x) => x.id === getAnswer(readinessQ, answers));
      readiness = o ? o.readiness : null;
    }

    const items = [];
    qs.forEach((q) => {
      if (!isScored(q) || !isVisible(q, answers)) return;
      const r = scoreQuestion(q, answers);
      if (r) items.push(Object.assign({ q }, r));
    });
    const scored = items.filter((i) => i.status === "scored");
    const r = Object.assign(base, { readiness, branched: !!readinessQ });

    r.unsureItems = items.filter((i) => i.status === "unsure");
    r.unsure = r.unsureItems.length;
    r.naList = items
      .filter((i) => i.status === "na" || (i.naItems && i.naItems.length))
      .map((i) => ({ q: i.q, whole: i.status === "na", items: i.naItems || [], answerText: i.answerText }));
    r.na = items.filter((i) => i.status === "na").length;

    if (r.branched) {
      // No process in place: every applicable requirement in this area is unmet.
      const dep = isDeployerOnly(answers);
      r.total = qs.filter((q) => isScored(q) && !(dep && q.providerOnly)).length;
      r.missing = r.total;
    } else {
      r.total = scored.length;
      r.met = scored.filter((i) => i.score >= 3 - 1e-9).length;
      r.missing = scored.filter((i) => i.score === 0).length;
      r.partial = r.total - r.met - r.missing;
      r.avg = r.total ? scored.reduce((s, i) => s + i.score, 0) / r.total : 0;
      r.gaps = scored
        .filter((i) => i.score < 3 - 1e-9)
        .sort((x, y) => x.score - y.score || (y.q.key ? 1 : 0) - (x.q.key ? 1 : 0))
        .map((i) => Object.assign(i, { sev: severity(i) }));
    }
    r.maturity = maturityFor(r.avg);
    r.insufficient = r.total === 0;
    r.provisional = !r.insufficient && r.unsure / (r.total + r.unsure) >= S.provisionalThreshold;
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
      gapCount: app.reduce((s, c) => s + c.gaps.length + (c.branched ? 1 : 0), 0),
      naChapters: chapters.filter((c) => c.notApplicable).length
    };
    R.maturity = maturityFor(R.avg);
    R.insufficient = R.total === 0;
    R.provisional = !R.insufficient && R.unsure / (R.total + R.unsure) >= S.provisionalThreshold;
    return R;
  }

  // ---------- Share links ---------------------------------------------------
  function encodeResult() {
    const parts = visibleQuestions(state.answers)
      .filter((q) => isAnswered(q, state.answers))
      .map((q) => {
        const a = getAnswer(q, state.answers);
        return q.id + "=" + (q.type === "multi" ? a.sel.join("") + a.na.map((x) => "~" + x).join("") : a);
      });
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
        if (!q || !val) return;
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

  // Intro ------------------------------------------------------------------
  function viewIntro() {
    viewingShared = false;
    clearHash();
    const saved = store.get();
    const hasProgress = saved && saved.answers && Object.keys(saved.answers).length > 0 && !saved.completed;

    const areas = ASSESSED.map(
      (ch, i) => `
        <li class="area">
          <span class="area-num">${String(i + 1).padStart(2, "0")}</span>
          <div><h3>${esc(ch.title)}</h3><p>${esc(ch.intro)}</p></div>
        </li>`
    ).join("");

    render(`
      <section class="intro">
        <p class="eyebrow">EU AI Act · Quality management self-assessment</p>
        <h1>How ready is your AI quality management system?</h1>
        <p class="lead">A structured self-assessment for organisations with high-risk AI systems, built against
          <strong>${esc(S.standardShort)}</strong>, the European standard for quality management systems under the EU AI Act.
          Answer for your organisation as it operates today and get a gap report you can act on and share.</p>

        <ul class="meta">
          <li><span class="meta-k">${ASSESSED.length}</span> assessment areas</li>
          <li><span class="meta-k">≤ ${MAX_QUESTIONS}</span> questions</li>
          <li><span class="meta-k">~10</span> minutes</li>
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

        <h2 class="section-title">What's covered</h2>
        <ol class="areas">${areas}</ol>

        <p class="disclaimer">This tool is an indicative self-assessment. It is not a conformity assessment, an audit, or legal advice,
          and it covers selected requirements of ${esc(S.standardShort)} rather than the full standard. Requirements are
          written mainly for providers; deployers are not marked down for activities their provider controls.</p>
      </section>
    `);

    document.getElementById("start").addEventListener("click", () => {
      state = { answers: {}, label: document.getElementById("label").value.trim(), current: ALL[0].id, date: null };
      persist();
      viewQuestion();
    });
    const resume = document.getElementById("resume");
    if (resume)
      resume.addEventListener("click", () => {
        state = Object.assign({ answers: {}, label: "", current: ALL[0].id }, saved);
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

    const chVis = vis.filter((x) => x.chapter === ch);
    const entryAnswered = isAnswered(ch.questions[0], state.answers);
    const chCount = entryAnswered ? chVis.length : ch.questions.filter((x) => x.role !== "readiness").length;
    const posInCh = chVis.findIndex((x) => x.id === q.id) + 1;
    const answeredCount = vis.filter((x) => isAnswered(x, state.answers)).length;
    const pct = Math.round((answeredCount / vis.length) * 100);
    const assessedIdx = ASSESSED.indexOf(ch);
    const sectionLabel = ch.scope ? esc(ch.title) : `Section ${assessedIdx + 1} of ${ASSESSED.length}`;

    const stepper = DATA.chapters
      .map((c, i) => {
        const cls = i < q.chapterIndex ? "done" : i === q.chapterIndex ? "active" : "";
        const n = c.scope ? "" : ASSESSED.indexOf(c) + 1;
        return `<li class="step ${cls} ${c.scope ? "step-scope" : ""}"><span class="step-dot">${i < q.chapterIndex ? checkIcon() : n || scopeIcon()}</span><span class="step-label">${esc(c.title)}</span></li>`;
      })
      .join("");

    const multi = q.type === "multi";
    const opts = effOptions(q, state.answers);
    const a = getAnswer(q, state.answers);
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

    const hint = [multi ? "Select all that apply" : "Select one answer"];
    if (multi && q.allowItemNA) hint.push("mark anything that doesn't apply to your AI systems as N/A");
    const isLast = idx === vis.length - 1;

    render(`
      <section class="quiz">
        <ol class="stepper" aria-label="Assessment sections">${stepper}</ol>
        <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Overall progress">
          <span style="width:${pct}%"></span>
        </div>
        <article class="qcard">
          <p class="qmeta">${sectionLabel} · Question ${posInCh} of ${chCount}</p>
          <h2 class="qtext" id="qtext">${esc(q.text)}</h2>
          <p class="qhint">${esc(hint.join(" · "))}</p>
          ${q.help ? `<p class="qhelp">${esc(q.help)}</p>` : ""}
          <fieldset class="options" aria-labelledby="qtext">${optHtml}</fieldset>
          <div class="qnav">
            <button class="btn btn-ghost" id="back">${arrowLeft()} ${idx === 0 ? "Introduction" : "Back"}</button>
            <button class="btn btn-primary" id="next" ${isAnswered(q, state.answers) ? "" : "disabled"}>${isLast ? "See results" : "Next"} ${arrowRight()}</button>
          </div>
        </article>
      </section>
    `);

    const fs = app.querySelector(".options");

    function writeMulti(sel, na) {
      state.answers[q.id] = sel.concat(na.map((x) => "~" + x));
    }
    function sync() {
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
      persist();
      const nowVis = visibleQuestions(state.answers);
      const nowLast = nowVis.findIndex((x) => x.id === q.id) === nowVis.length - 1;
      const next = document.getElementById("next");
      next.disabled = !isAnswered(q, state.answers);
      next.innerHTML = (nowLast ? "See results" : "Next") + " " + arrowRight();
    }

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
        sel = sel.filter((x) => x !== id && !opts.find((o) => o.id === x && (o.unsure || o.na)));
      }
      writeMulti(sel, na);
      sync();
    });

    document.getElementById("back").addEventListener("click", () => {
      if (idx === 0) return viewIntro();
      state.current = vis[idx - 1].id;
      persist();
      viewQuestion();
    });
    document.getElementById("next").addEventListener("click", goNext);
    app.querySelector(".qcard").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.target.matches("button")) { e.preventDefault(); goNext(); }
    });

    function goNext() {
      if (!isAnswered(q, state.answers)) return;
      const nowVis = visibleQuestions(state.answers);
      const i = nowVis.findIndex((x) => x.id === q.id);
      if (i === nowVis.length - 1) {
        state.date = new Date().toISOString().slice(0, 10);
        state.completed = true;
        persist();
        viewResults();
      } else {
        state.current = nowVis[i + 1].id;
        persist();
        viewQuestion();
      }
    }
  }

  // Results ----------------------------------------------------------------
  function viewResults(opts) {
    opts = opts || {};
    const R = overallResult(state.answers);
    const hash = "#r=" + encodeResult();
    try { history.replaceState(null, "", hash); } catch (e) { location.hash = hash; }

    const context = ALL.filter((q) => q.role === "context")
      .map((q) => {
        const o = effOptions(q, state.answers).find((x) => x.id === getAnswer(q, state.answers));
        return o ? `<span><span class="ctx-k">${esc(q.topic)}</span> ${esc(o.label || o.text)}</span>` : "";
      })
      .filter(Boolean)
      .join("");

    const notes = [];
    if (isDeployerOnly(state.answers))
      notes.push({
        title: "Assessed as a deployer",
        text: `${S.standardShort} is written mainly for providers. Activities controlled by your AI system's provider are treated as not applicable rather than as gaps.`
      });
    (S.coverageNotes || []).forEach((n) => { if (condMet(n.showIf, state.answers)) notes.push(n); });
    const notesHtml = notes.length
      ? `<div class="notes">${notes
          .map((n) => `<div class="note"><p class="note-title">${esc(n.title)}${n.ref && S.showClauseRefsInResults ? `<span class="ref">${esc(n.ref)}</span>` : ""}</p><p>${esc(n.text)}</p></div>`)
          .join("")}</div>`
      : "";

    const answersList = visibleQuestions(state.answers)
      .filter((q) => isAnswered(q, state.answers))
      .map((q) => {
        const a = getAnswer(q, state.answers);
        const eo = effOptions(q, state.answers);
        const ids = q.type === "multi" ? a.sel : [a];
        const texts = eo.filter((o) => ids.includes(o.id)).map((o) => `<li>${esc(o.text)}</li>`);
        if (q.type === "multi" && a.na.length)
          texts.push(`<li class="ans-na">Marked not applicable: ${esc(eo.filter((o) => a.na.includes(o.id)).map((o) => o.text).join("; "))}</li>`);
        return `<li><p class="ans-q">${esc(q.text)}</p><ul class="ans-a">${texts.join("")}</ul></li>`;
      })
      .join("");

    const bandLabel = R.insufficient ? "Not enough verified answers" : R.maturity.label + (R.provisional ? " · provisional" : "");

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
            <h1>${state.label ? esc(state.label) : "Your results"}</h1>
            <p class="lead small">Against selected requirements of ${esc(S.standard)}.</p>
            ${context ? `<p class="ctx">${context}</p>` : ""}
          </div>
          <div class="results-actions no-print">
            <button class="btn btn-primary" id="share">${shareIcon()} Share results</button>
            <button class="btn btn-secondary" id="print">${downloadIcon()} Save as PDF</button>
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

        <h2 class="section-title">By area</h2>
        <div class="chapters">${R.chapters.map(chapterCard).join("")}</div>

        ${safetySection(state.answers)}

        <details class="answers">
          <summary>Your answers</summary>
          <ol>${answersList}</ol>
        </details>

        <section class="method">
          <h2 class="section-title">How to read this report</h2>
          <p><strong>Requirements met</strong> counts applicable requirements where your answer reflects a documented, implemented
            practice. For "select all" questions this means every applicable activity is covered — items marked N/A are left out of
            the calculation, so coverage is measured against what applies to you. <strong>Maturity index</strong> averages your
            verified answers on a 0–3 scale (absent, informal, partially implemented, established), with each area weighted equally.</p>
          <p><strong>Not verified</strong> ("Not sure") and <strong>not applicable</strong> answers are kept out of the score and
            reported separately, so they are never counted as non-compliance. They aren't evidence of compliance either: when many
            answers are unverified the score is marked provisional, because an auditor would expect someone to be able to confirm
            each control and show evidence of it.</p>
          <p class="disclaimer">Indicative self-assessment only. Not a conformity assessment, certification, audit or legal advice.
            Clause references follow the final draft text of the standard and should be checked against the published edition.</p>
        </section>
      </section>
    `);

    const take = document.getElementById("take");
    if (take) take.addEventListener("click", () => { state = { answers: {}, label: "", current: null, date: null }; viewIntro(); });

    document.getElementById("share").addEventListener("click", async () => {
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
    document.getElementById("print").addEventListener("click", () => window.print());
    document.getElementById("retake").addEventListener("click", () => {
      if (!viewingShared && !confirm("Start a new assessment? Your current answers will be cleared from this browser (any link you've shared keeps working).")) return;
      store.clear();
      state = { answers: {}, label: state.label, current: ALL[0].id, date: null };
      viewingShared = false;
      clearHash();
      persist();
      viewQuestion();
    });
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
    if (c.notApplicable) {
      return `
        <article class="chapter chapter-na">
          <header class="chapter-head"><h3>${esc(c.ch.title)}</h3><span class="badge tone-none">Not applicable</span></header>
          <p class="gap-current">${esc(c.naReason)}</p>
        </article>`;
    }
    const maturityPct = Math.round((c.avg / 3) * 100);
    let body = "";
    if (c.branched) {
      const entry = c.ch.questions[0];
      body = `
        <ul class="gaps">
          <li class="gap">
            <div class="gap-head"><span class="tag tag-missing">Missing</span><span class="gap-topic">${esc(entry.topic)}</span>${refTag(entry.ref)}</div>
            <p class="gap-current">No established process is in place, so the detailed requirements in this area were not assessed and count as unmet.</p>
          </li>
        </ul>
        ${c.readiness ? `<p class="readiness"><span>Implementation plan</span><strong>${esc(c.readiness)}</strong></p>` : ""}`;
    } else if (!c.gaps.length && c.total) {
      body = `<p class="no-gaps">${checkIcon()} No gaps identified in the verified answers.</p>`;
    } else if (c.gaps.length) {
      body = `<p class="gaps-title">Gaps · ${c.gaps.length}</p><ul class="gaps">${c.gaps.map(gapItem).join("")}</ul>`;
    }

    if (c.unsureItems.length) {
      body += `<p class="gaps-title">Not verified · ${c.unsureItems.length}</p>
        <ul class="gaps side-list">${c.unsureItems
          .map((i) => `<li class="gap"><div class="gap-head"><span class="tag tag-unsure">Not sure</span><span class="gap-topic">${esc(i.q.topic)}</span>${refTag(i.q.ref)}</div>
            <p class="gap-current">Confirm who owns this and what evidence exists.</p></li>`)
          .join("")}</ul>`;
    }
    if (c.naList.length) {
      body += `<p class="gaps-title">Marked not applicable</p>
        <ul class="gaps side-list">${c.naList
          .map((n) => `<li class="gap"><div class="gap-head"><span class="tag tag-na">N/A</span><span class="gap-topic">${esc(n.q.topic)}</span>${refTag(n.q.ref)}</div>
            <p class="gap-current">${n.whole && n.answerText.length ? esc(n.answerText[0]) : "Marked not applicable: " + esc(n.items.join("; "))}</p></li>`)
          .join("")}</ul>`;
    }

    const band = c.insufficient
      ? `<span class="badge tone-none">Not verified</span>`
      : `<span class="badge tone-${c.maturity.tone}">${esc(c.maturity.label)}${c.provisional ? " · provisional" : ""}</span>`;

    return `
      <article class="chapter">
        <header class="chapter-head"><h3>${esc(c.ch.title)}</h3>${band}</header>
        <div class="chapter-metrics">
          <div class="metric">
            <div class="metric-top"><span>Requirements met</span><strong>${c.met} / ${c.total}</strong></div>
            ${compositionBar(c).replace('class="comp"', 'class="comp comp-compact"')}
          </div>
          <div class="metric">
            <div class="metric-top"><span>Maturity index</span><strong>${c.insufficient ? "–" : maturityPct}</strong></div>
            <div class="bar bar-soft"><span style="width:${c.insufficient ? 0 : maturityPct}%"></span></div>
          </div>
        </div>
        ${body}
      </article>`;
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
    return `<span class="ref">${esc(ref.split(";")[0].trim())}</span>`;
  }

  // ---------- AI Safety Indicator -------------------------------------------
  // Mappings, weights and texts live in assets/js/safety-config.js.
  // Internal values are computed here only to pick a level and an order;
  // they are never written to the page.
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
      // Skipped because the chapter's entry question said "no process": count as absent.
      const cr = chapterResult(q.chapter, answers);
      if (!cr.branched || q.role) return { status: "excluded" };
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
        state = own ? saved : { answers: decoded.answers, label: decoded.label, date: decoded.date, current: null };
        viewResults({ versionNote: decoded.version !== DATA.version });
        return;
      }
    }
    const saved = store.get();
    if (saved && saved.completed && saved.answers) {
      state = saved;
      viewResults();
      return;
    }
    viewIntro();
  }

  boot();
})();
