# EN 18286 Readiness Check

A self-assessment for providers of high-risk AI systems against **BS EN 18286:2026 — Artificial intelligence. Quality management system for EU AI Act regulatory purposes**.

Plain static site: HTML, CSS and vanilla JavaScript. No build step, no framework, no backend, no cookies, no third-party requests (the font is self-hosted).

## Files

```
index.html               The assessment (intro → questions → results)
about.html               Project, method, team bios, limitations
assets/js/questions.js   ← ALL questions, answers, branching and scoring live here
assets/js/safety-config.js  ← AI Safety Indicator: topics, weights, texts
assets/js/app.js         The engine (you shouldn't need to touch it)
assets/js/about.js       Team-photo fallback on the About page
assets/css/styles.css    Styling; colours are variables at the top
assets/img/              Put team photos here
assets/fonts/            Inter (self-hosted, OFL licence)
_headers                 Security headers for Cloudflare Pages
favicon.svg
```

## Publish (GitHub + Cloudflare Pages, free)

**1. Put the files on GitHub**
1. Sign in at github.com → **+** (top right) → **New repository**. Name it (e.g. `en18286-check`), set it to **Public** or **Private** (both work with Cloudflare), leave every "Initialize" box unticked, click **Create repository**.
2. On the empty repo page, click **uploading an existing file**.
3. Unzip the download, open the `en18286-check` folder, select **everything inside it** (not the folder itself) and drag it onto the upload area. `index.html` must end up at the top level of the repo.
4. Click **Commit changes**. Check that `index.html`, `about.html`, `_headers`, `favicon.svg` and the `assets` folder are listed.

**2. Connect Cloudflare Pages**
1. Sign in (or sign up free) at dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**. (If you only see Workers options, look for the Pages tab or a "Looking to deploy Pages?" link.)
2. Click **Connect GitHub**, authorise, and give access to **only this repository**.
3. Select the repo → **Begin setup**. Settings:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: *leave empty*
   - Build output directory: `/`
4. **Save and Deploy**. After ~30 seconds you get a live `https://<project>.pages.dev` link.

**3. Updating later:** edit any file on github.com (pencil icon → **Commit changes**). Cloudflare redeploys automatically within a minute.

**Optional:** custom domain — in the Pages project → **Custom domains** → **Set up a custom domain**.

*Alternative:* GitHub Pages alone also works (repo *Settings → Pages → Deploy from branch → main / root*); `_headers` is ignored there.

*Local preview:* open `index.html` directly, or run `python3 -m http.server` in this folder and visit `http://localhost:8000`.

## Changes not showing on the live site?

1. **Is Cloudflare connected to GitHub?** In Cloudflare → your project → **Deployments**, the newest entry should show your latest GitHub commit message. If it doesn't, or the project was created by drag-and-drop ("Direct Upload"), GitHub edits never reach the site — and a Direct Upload project can't be switched to Git later. Create a new Pages project with **Connect to Git** (steps above), then delete the old one.
2. **File names are case-sensitive.** `Andres.jpeg` ≠ `andres.jpg`. The `src` in `about.html` must match the file name on GitHub exactly.
3. **Straight quotes only.** HTML attributes need `"` — curly quotes (`“ ”`, which phones and word processors insert) break the tag.
4. **Cache.** Hard-refresh (Ctrl/Cmd + Shift + R) or open the page in a private window.

## Editing content

Everything is in `assets/js/questions.js`; a reference of every field is at the top of that file.

- **Change wording:** edit the `text` of a question or option.
- **Add a question:** copy an existing question block, give it a new unique `id`, and add the same `showIf` as its neighbours if it should be skipped when no process exists. Every question needs a `ref` (clause) or `source`; it's shown under the question as "Source: FprEN 18286:2026, § …".
- **Free-text questions:** `type: "text" | "longtext" | "email" | "url" | "country"`, with `optional: true` to allow skipping and `personal: true` for contact details.
- **Add a chapter:** copy a whole chapter block. The intro page, stepper and results pick it up automatically.
- **Branching:** `showIf: { question: "5.1", not: ["B"] }` shows a question unless 5.1 was answered B; `is: ["B"]` shows it only if it was.
- **Team bios:** edit `about.html` (marked with `EDIT` comments).
- **Colours:** variables at the top of `styles.css`.

**Share links store question and option `id`s.** Reordering options is safe as long as each keeps its `id`. If you change what an existing answer *means*, bump `version` in `questions.js`; older links will then show a notice.

## Structure (version 3)

- **Company Profile & Applicability** (unscored): company details (P01–P08, P02–P08 optional), AI activities and role (P09–P11, 0.1), EU connection (P12), the ONE AI system assessed (P13), its lifecycle stage (P13A), possible high-risk uses (P14), Article 6(3) exception (P14A), profiling (P15), existing management systems (P16).
- **Screening result** shown after the profile, with exactly three outcomes: **A** appears applicable, **B** does not appear applicable, **C** cannot be determined. B and C continue as a voluntary / "indicative — applicability unconfirmed" assessment. Logic: `screening()` in `app.js`. Application dates (Annex III 2 Dec 2027, Annex I 2 Aug 2028, per the Digital Omnibus on AI) are in `settings.commencement` — check them before relying on them.
- **Part A** company governance (Ch. 1–3), **Part B** company performance (Ch. 4–5), **Part C** AI system lifecycle (Ch. 6–11).
- The original question banks are kept verbatim, only moved: Risk (ids 5.x) → Chapter 6, Testing (ids 8.x) → Chapter 7, Data (ids 7.x) → Chapter 8. New questions use the ids from the specification (1.01, 6.ADD01, 7.ADD01 …). Ids are internal; users never see them.
- `0.2` (continuous learning, "any systems") was replaced by `7.ADD01` for the one system assessed, and the old § 8.8 coverage notice was removed.

## Applicability

- **Deployer-only respondents** (`settings.deployerOnlyAnswers`, answer B to `0.1`): original questions flagged `providerOnly` get an automatic "Not applicable" answer, as before. New provider-only questions use `providerOnlySkip` (skipped and listed with a reason); Chapter 10 is skipped as a whole for deployers. These are judgement calls — review them.
- **Conditional questions** (released systems, suppliers, modifications, non-compliance, continuous learning) depend on short context questions (`P13A`, `9.SUP`, `10.MOD`, `10.DEP`, `10.NC`, `4.08S`, `5.07S`, `7.ADD01`). When they don't apply they're listed in the report under "Not asked" with their `skipReason`, never as failures. Where the spec asks for it, a readiness version is shown instead (e.g. `10.06P` for pre-release systems).
- **"Not sure" on role** is assessed as a provider (the conservative reading).

## How scoring works

Every scored answer maps to a 0–3 maturity scale:

| Score | Meaning |
|---|---|
| 0 | Absent |
| 1 | Informal / ad hoc |
| 2 | Defined but partial or inconsistent |
| 3 | Documented and implemented (meets the requirement) |

- **Single choice:** each option has a `score`.
- **Select all that apply:** score = applicable required items ticked ÷ applicable required items × 3. Items are excluded from the denominator when hidden by role, or when the respondent marks them N/A (questions with `allowItemNA`: currently 7.2, 7.3, 8.4, where the standard says "as applicable"). Unticked applicable items are listed as specific gaps. If every item is marked N/A, the question counts as not applicable.
- **"Not sure"** is excluded from the score and reported as *not verified* — not as non-compliance. If at least 25% of applicable answers are "not sure" (`settings.provisionalThreshold`), the score is labelled provisional; if none can be verified, no score is shown.
- **"Not applicable"** is excluded from the score and listed separately.
- **No process at a gate question** (the first question of the original chapters — 5.1, 7.1, 8.1 — and 1.01, plus any question with `gate: true`, e.g. 2.04, 4.01, 4.04, 5.01, 6.ADD03, 6.ADD08, 7.ADD02, 9.05, 10.01, 10.06, 11.01, 11.11): its dependent questions are skipped, each counts as unmet, and the planning question ("Are you planning to establish …?") is reported as implementation status.
- **Recommended ("should") and optional ("may") questions** (`norm: "recommended"` / `"optional"`: 4.09, 4.11, 6.ADD12, 9.03, 9.04, 10.15) are not scored and are listed separately, never as gaps.
- **Readiness questions** (`role: "readiness"`) are reported as a status, not scored.
- **Key requirements** (`key: true`, currently 8.8 residual risk evaluation after validation) are flagged "Explicit requirement" in the gap list.

Per area and overall the report shows a breakdown (met / partial / missing / not verified / not applicable), **requirements met**, a **maturity index** (average verified score as 0–100, areas weighted equally, not-applicable areas excluded), a maturity band (`settings.maturityBands`) and gaps with clause references (hide with `settings.showClauseRefsInResults: false`).

## AI Safety Indicator

A second result under the readiness results: an *indication* of how far seven AI safety topics appear to be addressed, derived from the same answers. It adds no questions and doesn't change the readiness scoring. It is an awareness tool, not an assessment, score or rating; the wording in the config follows that rule.

**Everything is in `assets/js/safety-config.js`**: topics, tags and weights (with a one-line rationale per tag), level labels, all display texts, the per-question labels and sentences, and the "Not covered by this check" list. Change a weight there and the indications change; no code edits needed.

How it's calculated (logic in `app.js`, section "AI Safety Indicator"):
- Each answer → maturity 0–1 on the existing scale (absent 0, informal ⅓, partial ⅔, established 1). "Select all" options: ticked 1, not ticked 0, applicable options only.
- Per topic: weighted maturity = Σ(weight × maturity) / Σ(weight); internal value = round(100 × (1 − weighted maturity)) → Lower (0–25), Moderate (26–50), Elevated (51–75), Strong (76–100). The internal value is never displayed or put in the page.
- Excluded: "Not applicable", options marked N/A, and provider-only items for deployers (same rules as the readiness results). "Not sure" is excluded and listed under Unknowns.
- Questions skipped because the respondent said no process exists count as absent, as the readiness results do.
- "Limited information, very indicative" when a topic rests on fewer than 2 distinct questions; "No indication available" when it rests on none. Counts are distinct questions, not options.
- The summary only names topics that stand out; ties are never broken arbitrarily.

The share link carries answers only; the indicator is recomputed from them, so shared links reproduce it (including links made before the indicator existed).

## Privacy

There is no server-side code. Progress (including free-text answers, contact details and evidence notes) is kept in the browser's local storage so people can resume. A share link encodes only the multiple-choice answers and the optional label inside the URL fragment (`#r=…`), which browsers don't send to the server; it never contains free text, contact details, the AI system description or evidence notes. Sharing and JSON export each require an explicit confirmation; contact details are only included in the JSON export if the user ticks that option. Anyone holding a share link can view the results.

## JSON export

One record per question: `question_id`, `company_id` / `system_id`, `selected_option_ids`, `answer_text`, `status` (implemented / partial / missing / unknown / not_applicable / answered / skipped), `applicability_reason`, `source_clause`, `normative_label`, `timestamp`, `evidence_note`, plus the screening result and a per-chapter summary.
