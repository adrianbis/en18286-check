# EN 18286 Readiness Check

A self-assessment for providers of high-risk AI systems against **FprEN 18286:2026 — Artificial Intelligence: Quality Management System for EU AI Act Regulatory Purposes**. Built at [ML4Good](https://ml4good.org).

Plain static site: HTML, CSS and vanilla JavaScript. No build step, no framework, no backend, no cookies, no third-party requests (the font is self-hosted).

## Files

```
index.html               The assessment (intro → questions → results)
about.html               Project, method, team bios, limitations
assets/js/questions.js   ← ALL questions, answers, branching and scoring live here
assets/js/app.js         The engine (you shouldn't need to touch it)
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

## Editing content

Everything is in `assets/js/questions.js`; a reference of every field is at the top of that file.

- **Change wording:** edit the `text` of a question or option.
- **Add a question:** copy an existing question block, give it a new unique `id`, and add the same `showIf` as its neighbours if it should be skipped when no process exists.
- **Add a chapter:** copy a whole chapter block. The intro page, stepper and results pick it up automatically.
- **Branching:** `showIf: { question: "5.1", not: ["B"] }` shows a question unless 5.1 was answered B; `is: ["B"]` shows it only if it was.
- **Team bios:** edit `about.html` (marked with `EDIT` comments).
- **Colours:** variables at the top of `styles.css`.

**Share links store question and option `id`s.** Reordering options is safe as long as each keeps its `id`. If you change what an existing answer *means*, bump `version` in `questions.js`; older links will then show a notice.

## Applicability

The assessment opens with two scope questions (`0.1` role, `0.2` continuous learning). They are never scored.

- **Deployer-only respondents** (`settings.deployerOnlyAnswers`): questions flagged `providerOnly` get an automatic "Not applicable — carried out by the provider" answer, and options flagged `providerOnly` are hidden from "select all" questions. Answering N/A at an entry question (e.g. 8.1) marks the whole area not applicable. Current flags: options in 5.2, 7.2, 7.3; questions 7.4, 7.6 and 8.1 (all of Chapter 8). Review these — they're judgement calls.
- **"Not sure" on role** is assessed as a provider (the conservative reading).
- **Coverage notices** (`settings.coverageNotes`) flag what isn't covered yet. Currently: continuous-learning systems (§ 8.8), shown unless 0.2 = "No". When you write the § 8.8 branch, add a chapter whose questions use `showIf: { question: "0.2", not: ["B"] }` and remove the notice.

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
- **No process at an entry question** (5.1, 7.1, 8.1): detailed questions are skipped, every applicable requirement in that area counts as unmet, and the planning question (5.9, 7.9, 8.10) is reported as implementation status.
- **Key requirements** (`key: true`, currently 8.8 residual risk evaluation after validation) are flagged "Explicit requirement" in the gap list.

Per area and overall the report shows a breakdown (met / partial / missing / not verified / not applicable), **requirements met**, a **maturity index** (average verified score as 0–100, areas weighted equally, not-applicable areas excluded), a maturity band (`settings.maturityBands`) and gaps with clause references (hide with `settings.showClauseRefsInResults: false`).

## Privacy

There is no server-side code. Progress is kept in the browser's local storage so people can resume; a share link encodes the answers (and optional label) inside the URL fragment (`#r=…`), which browsers don't send to the server. Anyone holding the link can view the results.
