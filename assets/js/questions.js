/* ==========================================================================
   ASSESSMENT CONTENT — this is the only file you need to edit to change
   questions, answers, branching or scoring. See README.md for a guide.

   QUICK REFERENCE
   ---------------
   Question fields
     id        Unique, stable id (e.g. "5.2"). Used in share links, so don't
               reuse an id for a different question.
     type      "single" (one answer), "multi" (select all that apply), or a
               free-text type: "text", "longtext", "email", "url", "country".
               Free-text answers stay in the browser and are never put in
               share links.
     role      "readiness" = planning question, shown in results as a status,
               not scored. "context" = screening/applicability question,
               never scored. Leave out for normal scored questions.
     norm      Normative status: "required" (shall — the default),
               "recommended" (should) or "optional" (may). Only required
               questions are scored; the others are reported separately.
     text      The question shown to users.
     topic     Short label used in the results / gap list.
     help      Optional helper line shown under the question.
     ref       FprEN 18286 clause reference, shown under the question as
               "Source: FprEN 18286:2026, <ref>" and in the results.
     source    Use instead of ref when the source is not the standard
               (e.g. "EU AI Act Arts. 3, 16"). Shown as "Source: <source>".
     optional  Free-text / profile questions only: the user may skip it.
     personal  Personal data (contact details). Excluded from share links and
               from JSON export unless the user chooses to include it.
     showIf    Branching. { question: "5.1", not: ["B"] } = show unless 5.1 is B.
                          { question: "5.1", is:  ["B"] } = show only if 5.1 is B.
               For "select all" questions, is = any of these ticked,
               not = none of these ticked. An array of conditions means all
               must hold. If the referenced question is answered
               "Not applicable" or is itself hidden, dependent questions are
               skipped automatically.
     gate      true = a process-existence question. If a question that
               depends on it is hidden because of its answer, the dependent
               requirement counts as unmet (not as "not applicable").
               The first question of a chapter is treated as a gate
               automatically unless the chapter sets entry: null.
     skipReason  Text shown in the report when the question is skipped for a
               reason other than a gate (e.g. "Applies once released").
     providerOnly  true = an activity only a provider controls. Deployer-only
               respondents get an automatic "Not applicable" answer instead of
               failing it (wording: settings.providerNAText).
     providerOnlySkip  Like providerOnly, but the question is skipped for
               deployer-only respondents and listed as not applicable.
     allowItemNA   multi-choice only: each listed activity gets an "N/A" toggle,
               so coverage is measured against applicable items only. Use where
               the standard says "as applicable".
     key       true = explicitly required by the standard; flagged in results.
     keyNote   Optional short explanation shown with a key requirement.

   Option fields
     id        Stable letter/key. Share links store this, so if you reorder
               options keep each option's id attached to its text.
     text      Answer text.
     score     single-choice only: 0 = absent, 1 = informal, 2 = partial,
               3 = meets the requirement.
     required  multi-choice only: counts towards coverage (score = share of
               applicable required options ticked, scaled to 0–3).
     all       multi-choice only: "all of these" — counts every required
               option as covered.
     providerOnly  Option hidden for deployer-only respondents (multi-choice).
     exclusive Ticking it clears the others (e.g. "None", "Not sure").
     unsure    "Not sure" — left out of the score and reported separately as
               "not verified" (it is not counted as non-compliance).
     na        "Not applicable" — left out of the score, reported separately.
     readiness Label shown in results for readiness questions.

   If you change what an existing answer MEANS, bump `version` below so old
   share links show a "this link was made with an older version" notice.

   Chapters with `scope: true` hold context questions (role: "context"):
   they set applicability and are never scored. `part` groups chapters
   ("A", "B", "C") on the intro page and in the report.
   ========================================================================== */

(function () {
  // Shared answer sets for the new questions. Each is used read-only.
  const YES_NO = [
    { id: "A", text: "Yes", score: 3 },
    { id: "B", text: "No", score: 0 },
    { id: "C", text: "Not sure", unsure: true }
  ];
  const YES_PARTLY_NO = [
    { id: "A", text: "Yes", score: 3 },
    { id: "D", text: "Partly", score: 2 },
    { id: "B", text: "No", score: 0 },
    { id: "C", text: "Not sure", unsure: true }
  ];
  // STATUS: "D" = not established (used as the gate answer)
  const STATUS = [
    { id: "A", text: "Documented and implemented", score: 3 },
    { id: "B", text: "Documented, but not consistently implemented", score: 2 },
    { id: "C", text: "Done informally, not documented", score: 1 },
    { id: "D", text: "Not established", score: 0 },
    { id: "E", text: "Not sure", unsure: true }
  ];
  const EVIDENCE = [
    { id: "A", text: "Yes — documented, and the record can be shown", score: 3 },
    { id: "B", text: "Partly — documented, but incomplete or out of date", score: 2 },
    { id: "C", text: "Done, but not documented", score: 1 },
    { id: "D", text: "No", score: 0 },
    { id: "E", text: "Not sure", unsure: true }
  ];
  const CONTEXT_YN = [
    { id: "A", text: "Yes", label: "Yes" },
    { id: "B", text: "No", label: "No" },
    { id: "C", text: "Not sure", label: "Not sure", unsure: true }
  ];
  // Planning follow-up shown when a process gate is answered "No" / "Not established"
  const PLAN = [
    { id: "A", text: "No plan", readiness: "No plans" },
    { id: "B", text: "Exploring options", readiness: "Evaluating approaches" },
    { id: "C", text: "Plan approved, not started", readiness: "Plan approved, not started" },
    { id: "D", text: "Implementing", readiness: "Implementation under way" },
    { id: "E", text: "Not sure", readiness: "Unknown", unsure: true }
  ];
  // Readiness variant for conditional requirements that haven't been triggered yet
  const PROVIDED_FOR = [
    { id: "A", text: "Yes — our procedures already provide for this", readiness: "Provided for in procedures" },
    { id: "B", text: "Not yet — planned", readiness: "Planned" },
    { id: "C", text: "No", readiness: "Not provided for" },
    { id: "D", text: "Not sure", readiness: "Unknown", unsure: true }
  ];
  const NO_INCIDENT_HELP = "No incident history is needed: if this hasn't happened yet, answer for whether your procedure provides for it.";
  const NOT_RELEASED = "Applies once the AI system has been placed on the market or put into service.";

  window.ASSESSMENT = {
    version: 3,

    settings: {
      siteName: "EN 18286 Readiness Check",
      standard: "BS EN 18286:2026 — Artificial intelligence. Quality management system for EU AI Act regulatory purposes",
      standardShort: "BS EN 18286:2026",
      // Clause notes are shown with this prefix until checked against the published edition.
      refPrefix: "FprEN 18286:2026, ",
      refPrefixShort: "FprEN ",
      showClauseRefsInResults: true,

      // Applicability: which answer to the role question means "deployer only".
      roleQuestion: "0.1",
      deployerOnlyAnswers: ["B"],
      providerNAText: "Not applicable — this activity is carried out by the provider of our AI system.",

      // Question holding the one-line description of the AI system (Part C).
      // Source lines for preserved questions that have no ref of their own
      // (keeps the original question objects untouched).
      extraSources: { "0.1": "EU AI Act Art. 3(3)–(4)" },

      systemDescriptionQuestion: "P13",
      companyNameQuestion: "P01",

      // A score is labelled "provisional" when at least this share of the
      // applicable answers is "Not sure".
      provisionalThreshold: 0.25,

      parts: {
        A: { title: "Part A — Company governance", intro: "Answered once for the company." },
        B: { title: "Part B — Company performance", intro: "Answered once for the company." },
        C: { title: "Part C — AI system lifecycle", intro: "Answered for the one AI system described in your profile." }
      },

      screeningDisclaimer: "This is an indicative assessment based on EN 18286 and relevant EU AI Act QMS requirements, not legal advice, certification or a conformity assessment. Additional sector-specific requirements may apply; existing sector-specific QMS or governance arrangements may satisfy or support some requirements, but are not separately assessed here.",
      reportDisclaimer: "Additional sector-specific requirements may apply. Existing sector-specific QMS or internal governance arrangements may satisfy or support relevant requirements; this questionnaire does not assess them separately.",

      // EU AI Act application dates for high-risk obligations, as amended by the
      // Digital Omnibus on AI (Regulation (EU) 2026/1744). Check before relying on them.
      commencement: {
        annex3: "2 December 2027",
        annex1: "2 August 2028",
        note: "AI systems already placed on the market or put into service before the applicable date are generally covered only if their design changes significantly from that date. Dates as amended by the Digital Omnibus on AI (Regulation (EU) 2026/1744) — check the current text before relying on them."
      },

      // Notices shown in the results when a condition is met.
      coverageNotes: [
        {
          showIf: { question: "7.ADD01", is: ["C"] },
          title: "Continuous learning not confirmed",
          text: "You weren't sure whether the AI system continues to learn or change during operation, so the continuous-learning questions were skipped. If it does, additional requirements apply, including control, verification and validation of pre-determined changes.",
          ref: "§ 8.8"
        }
      ],
      // Maturity bands, applied to the average score (0–3).
      maturityBands: [
        { min: 2.5,  label: "Established",            tone: "good" },
        { min: 1.75, label: "Defined, not consistent", tone: "mid" },
        { min: 0.75, label: "Initial / informal",      tone: "low" },
        { min: 0,    label: "Not established",         tone: "none" }
      ]
    },

    chapters: [
      /* ------------------------------------------------------------------ */
      {
        id: "scope",
        scope: true,
        title: "Company Profile & Applicability",
        intro: "About your company and the one AI system you are assessing. Not scored. It decides whether the requirements appear to apply and which questions you see.",
        questions: [
          { id: "P01", type: "text", role: "context", topic: "Legal entity name", text: "Legal entity name", maxLength: 160 },
          { id: "P02", type: "url", role: "context", optional: true, topic: "Website", text: "Website", placeholder: "e.g. example.com" },
          { id: "P03", type: "country", role: "context", optional: true, topic: "Country of establishment", text: "Country of establishment" },
          {
            id: "P04", type: "single", role: "context", optional: true, topic: "Main industry", text: "Main industry",
            options: [
              { id: "A", text: "Technology / software", label: "Technology / software" },
              { id: "B", text: "Finance", label: "Finance" },
              { id: "C", text: "Healthcare", label: "Healthcare" },
              { id: "D", text: "Manufacturing", label: "Manufacturing" },
              { id: "E", text: "Education", label: "Education" },
              { id: "F", text: "HR", label: "HR" },
              { id: "G", text: "Public sector", label: "Public sector" },
              { id: "H", text: "Transport", label: "Transport" },
              { id: "I", text: "Other", label: "Other" }
            ]
          },
          {
            id: "P05", type: "single", role: "context", optional: true, topic: "Number of employees", text: "Number of employees",
            options: [
              { id: "A", text: "Fewer than 10", label: "<10" },
              { id: "B", text: "10–49", label: "10–49" },
              { id: "C", text: "50–249", label: "50–249" },
              { id: "D", text: "250 or more", label: "250+" },
              { id: "E", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "P06", type: "text", role: "context", optional: true, personal: true, topic: "Contact person", text: "Contact person’s full name", maxLength: 120,
            help: "Contact details are personal data. They stay in this browser, are never put in share links, and are only included in a JSON export if you choose to include them."
          },
          { id: "P07", type: "text", role: "context", optional: true, personal: true, topic: "Contact position", text: "Contact person’s position", maxLength: 120 },
          { id: "P08", type: "email", role: "context", optional: true, personal: true, topic: "Business email", text: "Business email address", placeholder: "name@company.com" },
          {
            id: "P09", type: "multi", role: "context", source: "EU AI Act Arts. 3, 16, 25",
            topic: "AI activities",
            text: "Which of the following best describe your company’s activities involving artificial intelligence (AI)? Select all that apply.",
            help: "A provider develops an AI system, or has it developed, and places it on the market or puts it into service under its own name. A deployer uses an AI system under its authority.",
            options: [
              { id: "A", text: "AI system development" },
              { id: "B", text: "Commissioned AI system development (others build it for us)" },
              { id: "C", text: "AI systems offered under our company name or trademark" },
              { id: "D", text: "Integration of third-party AI into our products or services" },
              { id: "E", text: "Internal use of AI systems" },
              { id: "F", text: "AI system import (bringing systems from outside the EU onto the EU market)" },
              { id: "G", text: "AI system distribution" },
              { id: "H", text: "Other" },
              { id: "I", text: "None", exclusive: true },
              { id: "J", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "P10", type: "single", role: "context", source: "EU AI Act Arts. 3, 16",
            topic: "Places AI on the EU market under own name",
            text: "Does the company place an AI system on the EU market or put it into service under its own name or trademark?",
            help: "Placing on the market means first making the system available in the EU. Putting into service means supplying it for first use, including for your own use.",
            options: [
              { id: "A", text: "Yes", label: "Yes" },
              { id: "B", text: "Planned", label: "Planned" },
              { id: "C", text: "No", label: "No" },
              { id: "D", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "P11", type: "multi", role: "context", source: "EU AI Act Art. 25",
            topic: "Changes to third-party AI systems",
            text: "Has the company rebranded, substantially modified, or changed the intended purpose of a third-party AI system?",
            help: "Under Article 25 of the EU AI Act, any of these can make your company the provider of a high-risk AI system.",
            options: [
              { id: "A", text: "Rebranded (put our name or trademark on it)" },
              { id: "B", text: "Substantially modified" },
              { id: "C", text: "Changed its intended purpose" },
              { id: "D", text: "None of these", exclusive: true },
              { id: "E", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
          id: "0.1", type: "single", role: "context",
          topic: "Role",
          text: "What is your organisation's role for the high-risk AI systems in scope?",
          help: "EN 18286 is written mainly for providers. Deployers are not marked down for activities their provider controls.",
          options: [
            { id: "A", text: "Provider — we develop AI systems, or have them developed, and place them on the market or put them into service under our name.", label: "Provider" },
            { id: "B", text: "Deployer — we use AI systems supplied by another organisation and do not develop or substantially modify them.", label: "Deployer" },
            { id: "C", text: "Both — we provide some AI systems and deploy others.", label: "Provider and deployer" },
            { id: "D", text: "Not sure.", label: "Not sure (assessed as provider)", unsure: true }
          ]
        },
          {
            id: "P12", type: "multi", role: "context", source: "EU AI Act Art. 2",
            topic: "Connection to the EU",
            text: "What is the AI system’s connection to the EU?",
            options: [
              { id: "A", text: "Provider established in the EU" },
              { id: "B", text: "Placing on the EU market" },
              { id: "C", text: "Putting into service in the EU" },
              { id: "D", text: "Output used in the EU" },
              { id: "E", text: "No known connection to the EU", exclusive: true },
              { id: "F", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "P13", type: "longtext", role: "context", ref: "§§ 4.3, 8.3.1.1, 8.7",
            topic: "AI system assessed",
            text: "Please describe the ONE AI system you would like to assess. Include what it does, its intended purpose, who uses it and who may be affected.",
            help: "Helpful to include: purpose, users, people affected, lifecycle stage, and what is inside and outside the system’s boundaries. Assess one AI system only.",
            maxLength: 2000
          },
          {
            id: "P13A", type: "single", role: "context", source: "Assessment design — decides which lifecycle questions are shown",
            topic: "Lifecycle stage",
            text: "What stage is this AI system at?",
            options: [
              { id: "A", text: "In development — not yet placed on the market or put into service", label: "In development (pre-release)" },
              { id: "B", text: "Placed on the market or put into service", label: "Released" },
              { id: "C", text: "Withdrawn or retired", label: "Withdrawn or retired" },
              { id: "D", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "P14", type: "multi", role: "context", source: "EU AI Act Art. 6(1)–(2), Annexes I and III",
            topic: "Possible high-risk uses",
            text: "Is this AI system intended for any of the following uses that may be classified as high-risk under the EU AI Act? Select all that apply. (For example: hiring decisions, exam admissions, or access to public benefits.)",
            help: "Choosing a category does not by itself make the system high-risk: the exact descriptions in the Act and its exceptions apply.",
            options: [
              { id: "A", text: "Biometric identification or categorisation — e.g. remote identification of people, inferring sensitive characteristics, emotion recognition" },
              { id: "B", text: "Management or operation of critical infrastructure — e.g. safety components for road traffic or water, gas, heating or electricity supply" },
              { id: "C", text: "Education or vocational training decisions — e.g. admissions, grading, exam monitoring" },
              { id: "D", text: "Recruitment, employment or worker management — e.g. CV screening, promotion or dismissal decisions, task allocation" },
              { id: "E", text: "Access to essential services or benefits — e.g. public benefits, creditworthiness, life and health insurance pricing, emergency call triage" },
              { id: "F", text: "Law enforcement — e.g. assessing the reliability of evidence" },
              { id: "G", text: "Migration, asylum or border control — e.g. assessing visa or asylum applications" },
              { id: "H", text: "Administration of justice or democratic processes — e.g. supporting judicial decisions, influencing elections" },
              { id: "I", text: "Safety component of a product covered by EU product legislation (Annex I), or such a product itself — e.g. medical devices, machinery, toys, lifts, vehicles", label: "Annex I product" },
              { id: "J", text: "None", exclusive: true },
              { id: "K", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "P14A", type: "single", role: "context", source: "EU AI Act Art. 6(3)–(4)",
            showIf: { question: "P14", is: ["A", "B", "C", "D", "E", "F", "G", "H"] },
            topic: "Article 6(3) exception",
            text: "Has your company concluded that this AI system is not high-risk under the Article 6(3) exception (for example, because it only performs a narrow procedural task)?",
            help: "Article 6(3) lets a provider conclude that a system in one of these use areas is not high-risk if it does not pose a significant risk of harm. The assessment must be documented before the system is placed on the market, and the exception never applies if the system profiles individuals.",
            options: [
              { id: "A", text: "No — we treat it as high-risk", label: "Not claimed" },
              { id: "B", text: "Yes — and the assessment is documented", label: "Claimed, documented" },
              { id: "C", text: "Yes — but the assessment is not documented", label: "Claimed, not documented" },
              { id: "D", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "P15", type: "single", role: "context", source: "EU AI Act Art. 6(3)",
            topic: "Profiling",
            text: "Does this AI system evaluate or predict personal characteristics, behaviour or circumstances of individual people (profiling)?",
            help: "Profiling means automated processing of personal data to evaluate or predict aspects of a person, such as work performance, economic situation, health, preferences, behaviour or location.",
            options: CONTEXT_YN
          },
          {
            id: "P16", type: "multi", role: "context", source: "Context only; FprEN 18286:2026, §§ 4.1, 4.3",
            topic: "Existing management systems",
            text: "Does your company already have a quality management system (QMS) — a set of policies, responsibilities and procedures for managing and checking the quality of its work?",
            options: [
              { id: "A", text: "ISO 9001 quality management system" },
              { id: "B", text: "ISO/IEC 42001 AI management system" },
              { id: "C", text: "Other externally certified management system" },
              { id: "D", text: "Internal quality management system" },
              { id: "E", text: "None", exclusive: true },
              { id: "F", text: "Not sure", exclusive: true, unsure: true }
            ]
          }
        ]
      },

      /* ================== PART A — COMPANY GOVERNANCE ================== */
      {
        id: "governance",
        part: "A",
        number: 1,
        title: "AI Governance & Leadership",
        intro: "Whether senior management has set up the quality management system, its policy, and who is responsible for what.",
        questions: [
          {
            id: "1.01", type: "single", ref: "§§ 4.1, 5.1",
            topic: "Quality management system established",
            text: "Has senior management established and maintained a quality management system (QMS) — documented policies, roles and processes for meeting applicable requirements?",
            options: YES_NO
          },
          {
            id: "1.02", type: "single", ref: "§ 5.2", gate: true,
            showIf: { question: "1.01", not: ["B"] },
            topic: "Quality policy",
            text: "Is a quality policy established, documented and maintained?",
            options: YES_NO
          },
          {
            id: "1.03", type: "single", ref: "§ 5.2",
            showIf: { question: "1.02", not: ["B"] },
            topic: "Communication of the quality policy",
            text: "How do you share the company’s quality policy with relevant staff?",
            options: [
              { id: "A", text: "Documented communication or training", score: 3 },
              { id: "B", text: "Informal communication", score: 1 },
              { id: "C", text: "Not communicated", score: 0 },
              { id: "D", text: "Not sure", unsure: true }
            ]
          },
          {
            id: "1.04", type: "single", ref: "§ 5.3.1",
            showIf: { question: "1.01", not: ["B"] },
            topic: "QMS responsibilities and authorities",
            text: "Are responsibilities and authorities for the quality management system assigned and documented?",
            options: YES_NO
          },
          {
            id: "1.05", type: "multi", ref: "§ 5.3.1",
            showIf: { question: "1.01", not: ["B"] },
            topic: "Assigned QMS responsibilities",
            text: "Which responsibilities have been assigned for regulatory monitoring, AI risk management and reporting on the quality management system?",
            options: [
              { id: "A", text: "Regulatory requirements owner", required: true },
              { id: "B", text: "AI risk owner", required: true },
              { id: "C", text: "Quality management system reporting owner", required: true },
              { id: "D", text: "All of these are assigned", all: true, exclusive: true },
              { id: "E", text: "None", exclusive: true },
              { id: "F", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "1.06", type: "single", ref: "§ 5.3.2",
            showIf: { question: "1.01", not: ["B"] },
            topic: "Authority to intervene",
            text: "Do personnel responsible for quality have the authority and autonomy to intervene and take action?",
            options: YES_NO
          },
          {
            id: "1.07", type: "single", ref: "§ 5.3.2",
            showIf: { question: "1.01", not: ["B"] },
            topic: "Approval of AI risk control measures",
            text: "Are responsibilities for approving AI risk control measures clearly assigned?",
            options: YES_NO
          },
          {
            id: "1.R", type: "single", role: "readiness", ref: "§§ 4.1, 5.1; readiness indicator",
            showIf: { question: "1.01", is: ["B"] },
            topic: "Plan for a quality management system",
            text: "Are you planning to establish a quality management system?",
            options: PLAN
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "regulatory",
        part: "A",
        number: 2,
        entry: null,
        title: "Regulatory Compliance Strategy",
        intro: "How the company identifies applicable requirements, sets the scope of its QMS and plans for compliance and conformity assessment.",
        questions: [
          {
            id: "2.01", type: "single", ref: "§ 4.2",
            topic: "Applicable regulatory requirements identified",
            text: "Has the company identified applicable regulatory requirements for AI systems covered by the quality management system?",
            options: YES_NO
          },
          {
            id: "2.02", type: "single", ref: "§ 4.2",
            topic: "Tracking regulatory changes",
            text: "How does your company keep track of changes to laws and regulations that apply to its AI systems?",
            options: [
              { id: "A", text: "Scheduled regulatory reviews with an assigned owner", score: 3 },
              { id: "B", text: "Ad hoc reviews when changes are noticed", score: 1 },
              { id: "C", text: "No defined approach", score: 0 },
              { id: "D", text: "Not sure", unsure: true }
            ]
          },
          {
            id: "2.03", type: "single", ref: "§ 4.3",
            topic: "QMS scope and covered AI systems",
            text: "Has the company documented which AI systems and boundaries are covered by its quality management system?",
            options: YES_NO
          },
          {
            id: "2.04", type: "single", ref: "§ 4.4.1", gate: true,
            topic: "Regulatory compliance strategy",
            text: "Does the company have a documented strategy for regulatory compliance?",
            options: YES_NO
          },
          {
            id: "2.05", type: "multi", ref: "§ 4.4.1.1",
            showIf: { question: "2.04", not: ["B"] },
            topic: "Scope of the compliance strategy",
            text: "Which matters are covered by the regulatory compliance strategy?",
            options: [
              { id: "A", text: "Essential requirements", required: true },
              { id: "B", text: "Post-market monitoring", required: true },
              { id: "C", text: "Serious incidents", required: true },
              { id: "D", text: "Data management", required: true },
              { id: "E", text: "Conformity assessment", required: true },
              { id: "F", text: "Modifications to AI systems", required: true },
              { id: "G", text: "None", exclusive: true },
              { id: "H", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "2.06", type: "single", ref: "§ 4.4.1.2",
            showIf: { question: "2.04", not: ["B"] },
            topic: "Strategy reflects intended purpose and conformity route",
            text: "Does the strategy take account of each AI system’s intended purpose, application area and conformity assessment procedure?",
            options: YES_NO
          },
          {
            id: "2.04R", type: "single", role: "readiness", ref: "§ 4.4.1; readiness indicator",
            showIf: { question: "2.04", is: ["B"] },
            topic: "Plan for a regulatory compliance strategy",
            text: "Are you planning to establish a documented regulatory compliance strategy?",
            options: PLAN
          },
          {
            id: "2.07", type: "multi", ref: "§ 4.4.2",
            topic: "Essential requirements identified",
            text: "Which of these requirements has your company identified as relevant to its AI systems?",
            options: [
              { id: "A", text: "Risk management", required: true },
              { id: "B", text: "Data governance", required: true },
              { id: "C", text: "Technical documentation", required: true },
              { id: "D", text: "Record-keeping", required: true },
              { id: "E", text: "Transparency", required: true },
              { id: "F", text: "Human oversight", required: true },
              { id: "G", text: "Accuracy, robustness and cybersecurity", required: true },
              { id: "H", text: "None", exclusive: true },
              { id: "I", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "2.08", type: "single", ref: "§ 4.4.3.2",
            topic: "Harmonised standards mapped in technical documentation",
            text: "Does technical documentation identify the essential requirements covered by the selected harmonised standards or common specifications?",
            help: "Harmonised standards are European standards that, once cited in the EU Official Journal, give a presumption of conformity with the requirements they cover. Common specifications are an alternative the European Commission can adopt.",
            options: YES_NO
          },
          {
            id: "2.09", type: "single", ref: "§ 4.4.1.1(e)",
            topic: "Conformity assessment procedure",
            text: "Has the company selected and followed the applicable conformity assessment procedure?",
            help: "Conformity assessment is how a provider shows a high-risk AI system meets the EU AI Act requirements before release — either by internal control or with a notified body (an independent organisation designated by a national authority).",
            options: YES_NO
          },
          {
            id: "2.10", type: "single", ref: "§ 4.1",
            topic: "QMS processes across lifecycle stages",
            text: "Are quality management system processes established and maintained throughout the applicable AI system lifecycle stages?",
            options: YES_NO
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "resources",
        part: "A",
        number: 3,
        entry: null,
        title: "Resources, Skills & Awareness",
        intro: "The people, expertise and infrastructure behind the QMS, and how the company communicates with staff, authorities and users.",
        questions: [
          {
            id: "3.01", type: "single", ref: "§ 7.1",
            topic: "Resources for the QMS",
            text: "Has your company identified and provided the people, expertise, tools and infrastructure needed to operate its quality management system?",
            options: YES_NO
          },
          {
            id: "3.02", type: "multi", ref: "§ 7.1",
            topic: "Resources considered in planning",
            text: "Which resources are considered when planning the quality management system?",
            options: [
              { id: "A", text: "Personnel and competence", required: true },
              { id: "B", text: "Technology-specific knowledge", required: true },
              { id: "C", text: "Infrastructure", required: true },
              { id: "D", text: "Security of supply", required: true },
              { id: "E", text: "None", exclusive: true },
              { id: "F", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "3.03", type: "single", ref: "§ 7.2.1",
            topic: "Required competence defined",
            text: "Has the company defined the competence required for personnel whose work affects the quality management system?",
            options: YES_NO
          },
          {
            id: "3.04", type: "multi", ref: "§ 7.2.1",
            topic: "Competence checks",
            text: "How does your company check that people working on AI governance have the right education, training or experience?",
            options: [
              { id: "A", text: "Review qualifications", required: true },
              { id: "B", text: "Assess experience", required: true },
              { id: "C", text: "Provide training", required: true },
              { id: "D", text: "Check training effectiveness", required: true },
              { id: "E", text: "No defined checks", exclusive: true },
              { id: "F", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "3.05", type: "single", ref: "§ 7.2.1",
            topic: "Closing competence gaps",
            text: "Are actions taken to obtain missing competence, and is their effectiveness evaluated?",
            options: YES_NO
          },
          {
            id: "3.06", type: "single", ref: "§ 7.2.1",
            topic: "Competence records",
            text: "Are records of personnel competence retained?",
            options: YES_NO
          },
          {
            id: "3.07", type: "single", ref: "§ 7.2.2",
            topic: "Expertise on health, safety and fundamental rights",
            text: "Does the company assess the expertise needed to address AI system impacts on health, safety and fundamental rights?",
            options: YES_NO
          },
          {
            id: "3.08", type: "single", ref: "§ 7.2.2",
            topic: "Usability and accessibility",
            text: "Does the company consider usability and accessibility for intended users, including persons with disabilities?",
            options: YES_NO
          },
          {
            id: "3.09", type: "single", ref: "§ 7.3.1",
            topic: "Communication planning",
            text: "Has the company planned what, when, how and with whom it communicates about applicable AI requirements?",
            options: YES_NO
          },
          {
            id: "3.10", type: "single", ref: "§ 7.3.1",
            topic: "Accessible communications",
            text: "Are communications accessible and adapted to relevant interested parties?",
            options: YES_NO
          },
          {
            id: "3.11", type: "single", ref: "§ 7.3.2.1",
            topic: "Communication procedures with external parties",
            text: "Does your company have procedures for communicating with regulators, independent assessment bodies, AI system users and other relevant parties?",
            help: "Independent assessment bodies include notified bodies — organisations designated by national authorities to carry out conformity assessments.",
            options: YES_NO
          },
          {
            id: "3.12", type: "single", ref: "§ 7.3.2.3",
            topic: "Providing documents to regulators on request",
            text: "Can your company provide regulators with requested compliance documents and records within the required time?",
            options: YES_NO
          },
          {
            id: "3.13", type: "single", ref: "§ 7.3.2.4",
            topic: "Information to demonstrate compliance",
            text: "Are procedures in place to collect and transmit information needed to demonstrate initial and ongoing compliance?",
            options: YES_NO
          },
          {
            id: "3.14", type: "single", ref: "§ 7.4",
            topic: "Awareness of policy and responsibilities",
            text: "Are relevant personnel aware of the quality policy, their quality management system responsibilities and the implications of failure to meet requirements?",
            options: YES_NO
          },
          {
            id: "3.15", type: "single", ref: "§ 7.3.2.2",
            topic: "Notifying parties of non-compliance, risks or serious incidents",
            text: "Does your company have procedures for notifying relevant parties when an AI system fails to meet requirements, presents a risk or causes a serious incident?",
            help: NO_INCIDENT_HELP,
            options: YES_NO
          }
        ]
      },

      /* ================== PART B — COMPANY PERFORMANCE ================== */
      {
        id: "performance",
        part: "B",
        number: 4,
        entry: null,
        title: "Performance Evaluation & Management Review",
        intro: "Quality objectives, and how management reviews whether the QMS works.",
        questions: [
          {
            id: "4.01", type: "single", ref: "§ 6.2.1", gate: true,
            topic: "Quality objectives",
            text: "Has the company established verifiable quality objectives consistent with its quality policy?",
            options: YES_NO
          },
          {
            id: "4.02", type: "single", ref: "§ 6.2.1",
            showIf: { question: "4.01", not: ["B"] },
            topic: "Objectives reflect regulatory requirements and are reviewed",
            text: "Do quality objectives take account of applicable regulatory requirements and undergo regular review?",
            options: YES_NO
          },
          {
            id: "4.03", type: "single", ref: "§ 6.2.2",
            showIf: { question: "4.01", not: ["B"] },
            topic: "Plans for achieving quality objectives",
            text: "Does the company document actions, processes, quality criteria and responsibilities for achieving quality objectives?",
            options: YES_NO
          },
          {
            id: "4.01R", type: "single", role: "readiness", ref: "§ 6.2; readiness indicator",
            showIf: { question: "4.01", is: ["B"] },
            topic: "Plan for quality objectives",
            text: "Are you planning to establish quality objectives?",
            options: PLAN
          },
          {
            id: "4.04", type: "single", ref: "§ 10.1.1.1", gate: true,
            topic: "Management reviews at planned intervals",
            text: "Are documented management reviews conducted at planned intervals?",
            options: YES_NO
          },
          {
            id: "4.05", type: "single", ref: "§ 10.1.1.1",
            showIf: { question: "4.04", not: ["B"] },
            topic: "Review of QMS effectiveness",
            text: "Does management review how well the quality management system works, including whether it protects people’s health, safety and fundamental rights?",
            options: YES_NO
          },
          {
            id: "4.06", type: "multi", ref: "§ 10.1.1.1",
            showIf: { question: "4.04", not: ["B"] },
            topic: "Management review topics",
            text: "Which topics are included in management reviews?",
            options: [
              { id: "A", text: "Quality policy", required: true },
              { id: "B", text: "Quality objectives", required: true },
              { id: "C", text: "Adherence to procedures", required: true },
              { id: "D", text: "Risk controls", required: true },
              { id: "E", text: "Interested parties", required: true },
              { id: "F", text: "Quality management system operational risks", required: true },
              { id: "G", text: "Regulatory changes", required: true },
              { id: "H", text: "None", exclusive: true },
              { id: "I", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "4.07", type: "single", ref: "§ 10.1.1.1",
            showIf: { question: "4.04", not: ["B"] },
            topic: "Top management participation",
            text: "Does top management participate periodically in quality management system reviews?",
            options: YES_NO
          },
          {
            id: "4.08S", type: "single", role: "context", source: "Assessment design — decides whether 4.08 applies",
            showIf: { question: "4.04", not: ["B"] },
            topic: "Serious-incident investigation found QMS inadequate",
            text: "Has a serious-incident investigation ever found your quality management system inadequate?",
            options: [
              { id: "A", text: "Yes", label: "Yes" },
              { id: "B", text: "No, or no serious incident has occurred", label: "No" },
              { id: "C", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "4.08", type: "single", ref: "§ 10.1.1.1",
            showIf: { question: "4.08S", is: ["A"] },
            skipReason: "No serious-incident investigation has found the QMS inadequate; the readiness question was asked instead.",
            topic: "Additional review after serious-incident findings",
            text: "Is an additional quality management system review conducted when a serious-incident investigation finds the quality management system inadequate?",
            options: YES_NO
          },
          {
            id: "4.08R", type: "single", role: "readiness", ref: "§ 10.1.1.1; readiness indicator",
            showIf: { question: "4.08S", not: ["A"] },
            topic: "Provision for an additional QMS review",
            text: "Do your procedures require an additional quality management system review if a serious-incident investigation finds the system inadequate?",
            options: PROVIDED_FOR
          },
          {
            id: "4.09", type: "multi", norm: "recommended", ref: "§ 10.1.2",
            showIf: { question: "4.04", not: ["B"] },
            topic: "Management review inputs",
            text: "What information does management consider when reviewing the quality management system?",
            options: [
              { id: "A", text: "Feedback", required: true },
              { id: "B", text: "Complaints", required: true },
              { id: "C", text: "Authority reports", required: true },
              { id: "D", text: "Audit results", required: true },
              { id: "E", text: "Quality management system measures", required: true },
              { id: "F", text: "AI system performance", required: true },
              { id: "G", text: "Corrective actions", required: true },
              { id: "H", text: "Prior actions", required: true },
              { id: "I", text: "Improvements", required: true },
              { id: "J", text: "New laws", required: true },
              { id: "K", text: "New standards", required: true },
              { id: "L", text: "None", exclusive: true },
              { id: "M", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "4.10", type: "single", ref: "§ 10.1.3",
            showIf: { question: "4.04", not: ["B"] },
            topic: "Documented review outputs",
            text: "Are management-review outputs documented, including decisions on improvements, regulatory changes and resources?",
            options: YES_NO
          },
          {
            id: "4.04R", type: "single", role: "readiness", ref: "§ 10.1; readiness indicator",
            showIf: { question: "4.04", is: ["B"] },
            topic: "Plan for management reviews",
            text: "Are you planning to establish documented management reviews?",
            options: PLAN
          },
          {
            id: "4.11", type: "single", norm: "optional", ref: "§ 10.1.1.2",
            topic: "Confidential channel for concerns",
            text: "Does the company provide a confidential channel for personnel to raise concerns about AI systems?",
            options: YES_NO
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "improvement",
        part: "B",
        number: 5,
        entry: null,
        title: "QMS Risk Management & Continuous Improvement",
        intro: "Risks to the QMS itself, and how changes to the QMS are planned, assessed and recorded.",
        questions: [
          {
            id: "5.01", type: "single", ref: "§ 6.1.1", gate: true,
            topic: "QMS risks identified",
            text: "Has your company identified problems that could stop its quality management system from working as intended?",
            options: YES_NO
          },
          {
            id: "5.02", type: "single", ref: "§ 6.1.2", gate: true,
            showIf: { question: "5.01", not: ["B"] },
            topic: "Actions to address QMS risks",
            text: "Does your company plan and take action to address risks to the quality management system?",
            options: YES_NO
          },
          {
            id: "5.03", type: "single", ref: "§ 6.1.2",
            showIf: { question: "5.02", not: ["B"] },
            topic: "Effectiveness of QMS risk actions",
            text: "Does your company check whether those actions have worked?",
            options: YES_NO
          },
          {
            id: "5.04", type: "multi", ref: "§ 6.1.3",
            showIf: { question: "5.01", not: ["B"] },
            topic: "Factors in QMS risk assessment",
            text: "Which factors does your company consider when assessing risks to its quality management system?",
            options: [
              { id: "A", text: "Regulatory compliance strategy", required: true },
              { id: "B", text: "AI technologies used", required: true },
              { id: "C", text: "Third parties", required: true },
              { id: "D", text: "Resources and competence", required: true },
              { id: "E", text: "None", exclusive: true },
              { id: "F", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "5.01R", type: "single", role: "readiness", ref: "§ 6.1; readiness indicator",
            showIf: { question: "5.01", is: ["B"] },
            topic: "Plan for managing QMS risks",
            text: "Are you planning to identify and address risks to your quality management system?",
            options: PLAN
          },
          {
            id: "5.05", type: "single", ref: "§ 10.2.1",
            topic: "Documented QMS change procedures",
            text: "Does your company follow documented procedures when changing its quality management system?",
            options: YES_NO
          },
          {
            id: "5.06", type: "single", ref: "§ 10.2.1",
            topic: "Records of QMS changes",
            text: "Does your company keep records of changes made to its quality management system?",
            options: YES_NO
          },
          {
            id: "5.07S", type: "single", role: "context", source: "Assessment design — decides whether 5.07 applies",
            topic: "New or substantially changed AI system added",
            text: "Has your company added a new AI system to its quality management system, or substantially changed one?",
            options: CONTEXT_YN
          },
          {
            id: "5.07", type: "single", ref: "§ 10.2.2",
            showIf: { question: "5.07S", is: ["A"] },
            skipReason: "No new or substantially changed AI system has been added; the readiness question was asked instead.",
            topic: "Reviewing procedures for new or changed AI systems",
            text: "When a new or substantially changed AI system is added, does your company check whether its governance procedures need updating?",
            options: YES_NO
          },
          {
            id: "5.07R", type: "single", role: "readiness", ref: "§ 10.2.2; readiness indicator",
            showIf: { question: "5.07S", not: ["A"] },
            topic: "Provision for reviewing procedures when AI systems change",
            text: "If a new or substantially changed AI system is added, would your procedures require a check on whether governance procedures need updating?",
            options: PROVIDED_FOR
          },
          {
            id: "5.08", type: "single", ref: "§ 10.2.3",
            topic: "Impact assessment before changing procedures",
            text: "Before changing governance procedures, does your company assess how the changes may affect its quality management system and AI systems?",
            options: YES_NO
          },
          {
            id: "5.09", type: "single", ref: "§ 10.2.3",
            topic: "Implementing and controlling changes",
            text: "Does your company implement and control the changes identified as necessary?",
            options: YES_NO
          }
        ]
      },

      /* ================== PART C — AI SYSTEM LIFECYCLE ================== */
      {
        id: "risk",
        part: "C",
        number: 6,
        title: "AI System Design, Risk Management & Fundamental Rights",
        intro: "How risks from the AI system — including risks to fundamental rights — are identified, assessed and controlled, and how its requirements and design are defined and checked.",
        questions: [
        {
          id: "5.1", type: "single", ref: "§ 8.2",
          topic: "Risk management process",
          text: "Does your company have a formal process for identifying, assessing and managing risks arising from its AI systems?",
          options: [
            { id: "A", text: "We have an informal process, but it is not fully documented.", score: 1 },
            { id: "B", text: "We have no established process.", score: 0 },
            { id: "C", text: "We have a documented process that is implemented and maintained.", score: 3 },
            { id: "D", text: "We have a documented process, but it is not consistently implemented.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "5.2", type: "multi", ref: "§§ 8.1.3, 8.2",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Lifecycle stages covered by risk assessment",
          text: "At which stages of the AI system lifecycle does your company assess AI-related risks?",
          options: [
            { id: "A", text: "Inception", required: true, providerOnly: true },
            { id: "B", text: "Design and development", required: true, providerOnly: true },
            { id: "C", text: "Verification and validation", required: true, providerOnly: true },
            { id: "D", text: "Operation and monitoring", required: true },
            { id: "E", text: "Modifications to the AI system", required: true },
            { id: "F", text: "Retirement", required: true },
            { id: "G", text: "We do not assess risks at any defined lifecycle stage", exclusive: true },
            { id: "H", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "5.3", type: "multi", ref: "§§ 3.4.2–3.4.3, 8.2",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Types of harm considered",
          text: "Which of the following types of harm does your company's AI risk assessment process consider?",
          options: [
            { id: "A", text: "Injury or damage to the health of a person or groups of persons", required: true },
            { id: "B", text: "Interference with fundamental rights", required: true },
            { id: "C", text: "Damage to property or the environment that can result in harm to health or interference with fundamental rights", required: true },
            { id: "D", text: "Disruption or destruction of critical infrastructure that can result in harm to health or interference with fundamental rights", required: true },
            { id: "E", text: "Tangible or intangible interference with fundamental rights, including physical, psychological, societal or economic interference", required: true },
            { id: "F", text: "None of the above", exclusive: true },
            { id: "G", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "5.4", type: "single", ref: "§§ 8.2, 4.5, 8.1.5",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Risk and mitigation documentation",
          text: "How does your company document identified AI-related risks and corresponding mitigation measures?",
          options: [
            { id: "A", text: "Risks are recorded informally, without a consistent documentation approach.", score: 1 },
            { id: "B", text: "Risks are documented for individual AI systems, using defined procedures.", score: 2 },
            { id: "C", text: "Risks are not documented.", score: 0 },
            { id: "D", text: "Risks are maintained in a structured risk register or equivalent system, with assigned responsibilities and mitigation measures.", score: 3 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "5.5", type: "single", ref: "§§ 5.3.1–5.3.2, 8.2",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Selection and approval of risk controls",
          text: "How does your company select, review and approve measures to control identified AI-related risks?",
          options: [
            { id: "A", text: "Risk control measures are selected and approved informally, without defined responsibilities.", score: 1 },
            { id: "B", text: "Risk control measures are not systematically selected or approved.", score: 0 },
            { id: "C", text: "Risk control measures are reviewed by relevant teams, but approval responsibilities are not formally assigned.", score: 2 },
            { id: "D", text: "Risk control measures are selected through a defined process and approved by personnel with assigned responsibilities and authority.", score: 3 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "5.6", type: "single", ref: "§ 8.2; additional maturity indicator",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Residual risk assessment",
          text: "How does your company assess the risks that remain after risk control measures have been implemented?",
          options: [
            { id: "A", text: "Residual risks are not assessed.", score: 0 },
            { id: "B", text: "Residual risks are assessed using documented criteria and an established approval process.", score: 3 },
            { id: "C", text: "Residual risks are discussed informally, without defined assessment criteria.", score: 1 },
            { id: "D", text: "Residual risks are documented, but no formal decision is made about their acceptability.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "5.7", type: "single", ref: "§§ 8.1.4(d)(7), 8.3.1.2; Annex A",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Involvement of affected persons",
          text: "How does your company involve affected persons or their representatives when assessing AI-related risks?",
          options: [
            { id: "A", text: "We consult affected persons occasionally, without a defined approach.", score: 1 },
            { id: "B", text: "We systematically consider whether consultation is needed and conduct it where relevant.", score: 3 },
            { id: "C", text: "We do not consult affected persons or their representatives.", score: 0 },
            { id: "D", text: "We consult affected persons for selected high-impact AI systems, but not through a consistent process.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true },
            { id: "F", text: "Not applicable — no consultation need has been identified following an assessment.", na: true }
          ]
        },
        {
          id: "5.8", type: "multi", ref: "§§ 8.2, 9.4, 9.5.4",
          showIf: { question: "5.1", not: ["B"] },
          topic: "Triggers for risk reassessment",
          text: "Which events or circumstances trigger a reassessment of AI-related risks in your company?",
          options: [
            { id: "A", text: "Modifications to an AI system, including updates or retraining", required: true },
            { id: "B", text: "New information from monitoring, complaints or incidents", required: true },
            { id: "C", text: "Changes to the AI system's intended purpose or operating environment", required: true },
            { id: "D", text: "Scheduled periodic reviews", required: true },
            { id: "E", text: "Identification of new or emerging hazards", required: true },
            { id: "F", text: "No defined events trigger a risk reassessment", exclusive: true },
            { id: "G", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "5.9", type: "single", role: "readiness", ref: "§ 8.2; readiness indicator",
          showIf: { question: "5.1", is: ["B"] },
          topic: "Plan for a risk management process",
          text: "What is your company's current plan for establishing an AI risk management process?",
          options: [
            { id: "A", text: "We have no plans to establish a formal process.", readiness: "No plans" },
            { id: "B", text: "We are currently implementing a formal process.", readiness: "Implementation under way" },
            { id: "C", text: "We are evaluating possible approaches but have not made a decision.", readiness: "Evaluating approaches" },
            { id: "D", text: "We have approved a plan but have not started implementation.", readiness: "Plan approved, not started" },
            { id: "E", text: "Not sure.", readiness: "Unknown", unsure: true }
          ]
        },

          /* --- Additions (design and lifecycle) ---------------------------- */
          {
            id: "6.ADD01", type: "single", ref: "§ 8.3.1.1", providerOnlySkip: true,
            topic: "Intended purpose documented",
            text: "Is the intended purpose of each AI system determined and documented?",
            options: EVIDENCE
          },
          {
            id: "6.ADD02", type: "multi", ref: "§ 8.1.3",
            topic: "Lifecycle stages and processes defined",
            text: "Are applicable AI system lifecycle stages and the corresponding processes defined?",
            options: [
              { id: "A", text: "Inception", required: true, providerOnly: true },
              { id: "B", text: "Design and development", required: true, providerOnly: true },
              { id: "C", text: "Verification and validation", required: true, providerOnly: true },
              { id: "D", text: "Operation and monitoring", required: true },
              { id: "E", text: "Modification", required: true },
              { id: "F", text: "Retirement", required: true },
              { id: "G", text: "None", exclusive: true },
              { id: "H", text: "Not sure", exclusive: true, unsure: true }
            ]
          },
          {
            id: "6.ADD03", type: "single", ref: "§ 8.3.2.1.1", gate: true, providerOnlySkip: true,
            topic: "AI system requirements defined",
            text: "Are AI system requirements defined to meet applicable regulatory and essential requirements?",
            options: STATUS
          },
          {
            id: "6.ADD04", type: "single", ref: "§ 8.3.2.1.2", providerOnlySkip: true,
            showIf: { question: "6.ADD03", not: ["D"] },
            topic: "Quality of AI system requirements",
            text: "Are AI system requirements complete, unambiguous, and capable of verification and validation?",
            options: YES_NO
          },
          {
            id: "6.ADD05", type: "single", ref: "§ 8.3.2.2", gate: true, providerOnlySkip: true,
            showIf: { question: "6.ADD03", not: ["D"] },
            topic: "Review and approval of requirements",
            text: "Are AI system requirements reviewed and approved before specifications are defined, and reviewed during development and testing?",
            options: STATUS
          },
          {
            id: "6.ADD06", type: "single", ref: "§ 8.3.2.2", providerOnlySkip: true,
            showIf: { question: "6.ADD05", not: ["D"] },
            topic: "Content of requirement reviews",
            text: "Do requirement reviews confirm that requirements are documented, cover applicable obligations and can be met?",
            options: YES_NO
          },
          {
            id: "6.ADD07", type: "single", ref: "§ 8.3.2.2", providerOnlySkip: true,
            showIf: { question: "6.ADD05", not: ["D"] },
            topic: "Records of requirement reviews",
            text: "Are review results and follow-up actions retained as documented information?",
            options: EVIDENCE
          },
          {
            id: "6.R1", type: "single", role: "readiness", ref: "§ 8.3.2.1; readiness indicator", providerOnlySkip: true,
            showIf: { question: "6.ADD03", is: ["D"] },
            topic: "Plan for defining AI system requirements",
            text: "Are you planning to define AI system requirements?",
            options: PLAN
          },
          {
            id: "6.ADD08", type: "single", ref: "§ 8.3.2.3", gate: true, providerOnlySkip: true,
            topic: "AI system specifications",
            text: "Are verifiable AI system specifications documented, describing the design and how it meets system requirements?",
            options: STATUS
          },
          {
            id: "6.ADD09", type: "single", ref: "§ 8.3.2.3", providerOnlySkip: true,
            showIf: { question: "6.ADD08", not: ["D"] },
            topic: "Specifications in technical documentation",
            text: "Are AI system specifications maintained in the technical documentation?",
            options: EVIDENCE
          },
          {
            id: "6.ADD10", type: "single", ref: "§ 8.3.2.4", providerOnlySkip: true,
            showIf: { question: "6.ADD08", not: ["D"] },
            topic: "Design reviews, verification and validation",
            text: "Are design reviews, verification and validation used to confirm that specifications meet AI system requirements?",
            options: YES_NO
          },
          {
            id: "6.ADD11", type: "single", ref: "§ 8.3.2.4", providerOnlySkip: true,
            showIf: { question: "6.ADD08", not: ["D"] },
            topic: "Addressing design verification problems",
            text: "Are problems identified during design verification or validation addressed and the actions recorded?",
            options: EVIDENCE
          },
          {
            id: "6.R2", type: "single", role: "readiness", ref: "§ 8.3.2.3; readiness indicator", providerOnlySkip: true,
            showIf: { question: "6.ADD08", is: ["D"] },
            topic: "Plan for documenting AI system specifications",
            text: "Are you planning to document verifiable AI system specifications?",
            options: PLAN
          },
          {
            id: "6.ADD12", type: "single", norm: "recommended", ref: "§ 8.3.1.2; Annex A",
            topic: "Considering consultation of affected persons",
            text: "Has the company considered consulting affected persons or their representatives about risks to health, safety and fundamental rights?",
            options: YES_NO
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "testing",
        part: "C",
        number: 7,
        title: "Testing, Validation & Technical Safety",
        intro: "How the AI system is verified against its specifications, validated for its intended purpose, how results are recorded and acted on — and, if it keeps learning, how changes are controlled.",
        questions: [
        {
          id: "8.1", providerOnly: true, naText: "Not applicable — verification and validation are carried out by the provider of our AI system.", type: "single", ref: "§ 8.4",
          topic: "Verification and validation process",
          text: "Does your company have a documented process for verifying and validating AI systems?",
          options: [
            { id: "A", text: "We conduct some tests, but without a consistent documented process.", score: 1 },
            { id: "B", text: "We have documented verification and validation procedures that are implemented.", score: 3 },
            { id: "C", text: "We do not have a defined verification or validation process.", score: 0 },
            { id: "D", text: "We have documented procedures, but they are only partially implemented.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "8.2", type: "single", ref: "§§ 8.4.2, 8.3.2.3",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Verification against specifications",
          text: "What does your company test AI systems against during verification?",
          options: [
            { id: "A", text: "Tests are mainly exploratory, without predefined specifications.", score: 1 },
            { id: "B", text: "Tests systematically verify that the AI system meets its documented specifications.", score: 3 },
            { id: "C", text: "Tests are based on informal technical expectations.", score: 1 },
            { id: "D", text: "Tests use documented specifications for some, but not all, relevant system components.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "8.3", type: "multi", ref: "§ 8.4.2(a)–(c)",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Factors covered by verification test plans",
          text: "Which factors are covered by your company's verification testing plans?",
          options: [
            { id: "A", text: "The AI system's specified intended purpose", required: true },
            { id: "B", text: "Identified reasonably foreseeable misuse", required: true },
            { id: "C", text: "Defined test methods", required: true },
            { id: "D", text: "Numerical limits, ranges or other verifiable acceptance measures", required: true },
            { id: "E", text: "Reproducibility of testing", required: true },
            { id: "F", text: "Alignment with relevant technology-specific best practices", required: true },
            { id: "G", text: "None of the above", exclusive: true },
            { id: "H", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "8.4", allowItemNA: true, type: "multi", ref: "§ 8.4.2(c)(1)–(6)",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Testing conditions documented for reproducibility",
          text: "Which testing conditions does your company document to support reproducibility?",
          options: [
            { id: "A", text: "Hardware and compute environment specifications", required: true },
            { id: "B", text: "Software frameworks, programming languages and library versions", required: true },
            { id: "C", text: "Random seed values and initialization procedures", required: true },
            { id: "D", text: "Model training parameters and hyperparameters", required: true },
            { id: "E", text: "Dataset versions and preprocessing steps", required: true },
            { id: "F", text: "Stochastic elements and how they are handled", required: true },
            { id: "G", text: "None of the above", exclusive: true },
            { id: "H", text: "Not sure.", exclusive: true, unsure: true },
            { id: "I", text: "Not applicable — the selected testing conditions do not apply to our AI systems.", exclusive: true, na: true }
          ]
        },
        {
          id: "8.5", type: "single", ref: "§ 8.4.3.1(a)–(b)",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Validation against intended purpose",
          text: "How does your company validate that an AI system is capable of fulfilling its specified intended purpose?",
          options: [
            { id: "A", text: "We rely mainly on developer judgement without a documented validation procedure.", score: 1 },
            { id: "B", text: "We validate against documented procedures, taking account of the instructions for use and technical documentation.", score: 3 },
            { id: "C", text: "We do not conduct intended-purpose validation.", score: 0 },
            { id: "D", text: "We conduct validation tests, but do not consistently use documented procedures or system documentation.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "8.6", type: "multi", ref: "§ 8.4.3.1(c)–(d)",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Timing of validation",
          text: "When does your company carry out AI system validation?",
          options: [
            { id: "A", text: "During AI system development", required: true },
            { id: "B", text: "After AI system development", required: true },
            { id: "C", text: "Before placing the AI system on the market or putting it into service", required: true },
            { id: "D", text: "Only after deployment", exclusive: true },
            { id: "E", text: "We do not have defined validation stages", exclusive: true },
            { id: "F", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "8.7", type: "single", ref: "§§ 8.4.2(b), 8.4.3.1(e)",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Acceptance criteria for test results",
          text: "How does your company determine whether verification and validation results are acceptable?",
          options: [
            { id: "A", text: "Acceptance decisions are made informally by the technical team.", score: 1 },
            { id: "B", text: "We use documented test procedures with defined methods and acceptance limits or other suitable measures.", score: 3 },
            { id: "C", text: "We do not define acceptance criteria.", score: 0 },
            { id: "D", text: "We define acceptance criteria for some tests but not consistently.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "8.8", key: true, keyNote: "The standard explicitly requires a residual risk evaluation based on validation results.", type: "single", ref: "§ 8.4.3.1",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Residual risk evaluation after validation",
          text: "How does your company evaluate remaining AI-related risks after validation?",
          options: [
            { id: "A", text: "We do not assess residual risks after validation.", score: 0 },
            { id: "B", text: "We perform and document a residual risk evaluation based on validation results.", score: 3 },
            { id: "C", text: "We discuss residual risks informally without a defined evaluation.", score: 1 },
            { id: "D", text: "We evaluate residual risks for some AI systems but not consistently.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "8.9", type: "single", ref: "§§ 8.3.2.4, 8.4.2, 8.4.3.1",
          showIf: { question: "8.1", not: ["C"] },
          topic: "Recording results and corrective action",
          text: "How does your company record verification and validation outcomes and address identified problems?",
          options: [
            { id: "A", text: "We record test results but do not consistently track follow-up actions.", score: 1 },
            { id: "B", text: "We retain documented results and conclusions and take necessary actions to address identified problems.", score: 3 },
            { id: "C", text: "We do not systematically document results or corrective actions.", score: 0 },
            { id: "D", text: "We document results and follow-up actions for some AI systems only.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "8.10", type: "single", role: "readiness", ref: "§ 8.4; readiness indicator",
          showIf: { question: "8.1", is: ["C"] },
          topic: "Plan for a verification and validation process",
          text: "What is your company's current plan for establishing a documented verification and validation process?",
          options: [
            { id: "A", text: "We have approved a plan but have not started implementation.", readiness: "Plan approved, not started" },
            { id: "B", text: "We have no plans to establish a formal process.", readiness: "No plans" },
            { id: "C", text: "We are currently implementing a formal process.", readiness: "Implementation under way" },
            { id: "D", text: "We are evaluating possible approaches but have not made a decision.", readiness: "Evaluating approaches" },
            { id: "E", text: "Not sure.", readiness: "Unknown", unsure: true }
          ]
        },

          /* --- Additions (continuous learning, § 8.8) ---------------------- */
          {
            id: "7.ADD01", type: "single", role: "context", ref: "§ 8.8",
            showIf: { question: "8.1", not: [] },
            topic: "Continuous learning",
            text: "Does the AI system continue learning or changing during operation?",
            options: CONTEXT_YN
          },
          {
            id: "7.ADD02", type: "single", ref: "§ 8.8", gate: true,
            showIf: { question: "7.ADD01", is: ["A"] },
            skipReason: "Applies only to AI systems that continue to learn or change during operation.",
            topic: "Pre-determined changes defined and controlled",
            text: "Are pre-determined changes to the continuously learning AI system defined and controlled?",
            options: STATUS
          },
          {
            id: "7.ADD03", type: "single", ref: "§ 8.8",
            showIf: { question: "7.ADD02", not: ["D"] },
            topic: "Pre-determined changes in risk management",
            text: "Are pre-determined changes covered by the risk management process and applicable lifecycle activities?",
            options: YES_NO
          },
          {
            id: "7.ADD04", type: "single", ref: "§ 8.8",
            showIf: { question: "7.ADD02", not: ["D"] },
            topic: "Verification and validation of pre-determined changes",
            text: "Are all pre-determined changes verified and validated?",
            options: YES_NO
          },
          {
            id: "7.ADD05", type: "single", ref: "§ 8.8",
            showIf: { question: "7.ADD02", not: ["D"] },
            topic: "Logging of changes",
            text: "Are pre-determined changes and other modifications logged?",
            options: EVIDENCE
          },
          {
            id: "7.ADD06", type: "single", ref: "§ 8.8",
            showIf: { question: "7.ADD02", not: ["D"] },
            topic: "Technical documentation on continuous learning",
            text: "Does technical documentation describe how the system learns, the expected changes, their effects and the data used?",
            options: EVIDENCE
          },
          {
            id: "7.ADD07", type: "single", ref: "§ 8.8",
            showIf: { question: "7.ADD02", not: ["D"] },
            topic: "Instructions for use on continuous learning",
            text: "Do instructions for use explain continuous learning, its effects and relevant deployment or maintenance considerations?",
            options: EVIDENCE
          },
          {
            id: "7.R", type: "single", role: "readiness", ref: "§ 8.8; readiness indicator",
            showIf: { question: "7.ADD02", is: ["D"] },
            topic: "Plan for controlling pre-determined changes",
            text: "Are you planning to define and control pre-determined changes for this AI system?",
            options: PLAN
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "data",
        part: "C",
        number: 8,
        title: "Data Governance & Management",
        intro: "How data used by your AI systems is defined, managed, kept compliant, documented and decommissioned.",
        questions: [
        {
          id: "7.1", type: "single", ref: "§ 8.5",
          topic: "Data management process",
          text: "Does your company have a documented data management process for AI systems?",
          options: [
            { id: "A", text: "We manage data informally without documented procedures.", score: 1 },
            { id: "B", text: "We have documented and implemented data management processes.", score: 3 },
            { id: "C", text: "We do not have a defined data management process.", score: 0 },
            { id: "D", text: "We have documented procedures, but they are not consistently implemented.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "7.2", allowItemNA: true, type: "multi", ref: "§ 8.5, opening paragraph",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Data types covered",
          text: "Which types of data are covered by your company's AI data management processes?",
          options: [
            { id: "A", text: "Training data", required: true, providerOnly: true },
            { id: "B", text: "Validation data", required: true, providerOnly: true },
            { id: "C", text: "Testing data", required: true, providerOnly: true },
            { id: "D", text: "Logging data", required: true },
            { id: "E", text: "Input data", required: true },
            { id: "F", text: "Other data used to place an AI system on the market or put it into service", required: true, providerOnly: true },
            { id: "G", text: "None of these data types", exclusive: true },
            { id: "H", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "7.3", allowItemNA: true, type: "multi", ref: "§ 8.5(b)(1)–(9)",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Data management activities covered",
          text: "Which data management activities are covered by your company's documented procedures?",
          options: [
            { id: "A", text: "Data acquisition", required: true, providerOnly: true },
            { id: "B", text: "Data mining and collection", required: true, providerOnly: true },
            { id: "C", text: "Data analysis", required: true, providerOnly: true },
            { id: "D", text: "Data labelling", required: true, providerOnly: true },
            { id: "E", text: "Data filtration", required: true, providerOnly: true },
            { id: "F", text: "Data aggregation", required: true, providerOnly: true },
            { id: "G", text: "Data retention", required: true },
            { id: "H", text: "Data storage", required: true },
            { id: "I", text: "Other data operations performed before placing an AI system on the market or putting it into service", required: true, providerOnly: true },
            { id: "J", text: "None of these activities", exclusive: true },
            { id: "K", text: "Not sure.", exclusive: true, unsure: true }
          ]
        },
        {
          id: "7.4", providerOnly: true, type: "single", ref: "§ 8.5(a)",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Data requirements per AI system",
          text: "How does your company define the data requirements for each AI system?",
          options: [
            { id: "A", text: "Data requirements are identified informally by the technical team.", score: 1 },
            { id: "B", text: "Data requirements are defined, documented and applied for each relevant AI system.", score: 3 },
            { id: "C", text: "Data requirements are not explicitly defined.", score: 0 },
            { id: "D", text: "Data requirements are documented for some AI systems but not consistently applied.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "7.5", type: "single", ref: "§§ 8.5, 4.4",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Regulatory compliance of data practices",
          text: "How does your company ensure that data management practices comply with applicable regulatory requirements?",
          options: [
            { id: "A", text: "We address regulatory requirements only when an issue is identified.", score: 1 },
            { id: "B", text: "We maintain a documented compliance strategy that is applied through data management procedures.", score: 3 },
            { id: "C", text: "We have not identified the applicable regulatory requirements.", score: 0 },
            { id: "D", text: "We have identified relevant requirements but have not fully integrated them into our procedures.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "7.6", providerOnly: true, type: "single", ref: "§ 8.5",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Data management across the development lifecycle",
          text: "How does your company manage data across AI system design, development, verification and validation?",
          options: [
            { id: "A", text: "Data management is addressed separately by teams without a consistent approach.", score: 1 },
            { id: "B", text: "Data management procedures are defined, documented and implemented across the relevant activities.", score: 3 },
            { id: "C", text: "Data management is not systematically addressed during these activities.", score: 0 },
            { id: "D", text: "Data management procedures exist but cover only some relevant activities.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "7.7", type: "single", ref: "§ 8.5, data decommissioning",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Data decommissioning",
          text: "How does your company handle data when it is no longer needed for the AI system?",
          options: [
            { id: "A", text: "We retain data indefinitely without a defined review process.", score: 0 },
            { id: "B", text: "We apply documented destruction or archiving mechanisms, taking applicable regulatory requirements into account.", score: 3 },
            { id: "C", text: "We delete data informally when storage is no longer needed.", score: 1 },
            { id: "D", text: "We have defined retention periods but no consistent destruction or archiving process.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true },
            { id: "F", text: "Not applicable — no data decommissioning is currently required.", na: true }
          ]
        },
        {
          id: "7.8", type: "single", ref: "§§ 8.5, 4.5",
          showIf: { question: "7.1", not: ["C"] },
          topic: "Evidence of implementation",
          text: "How does your company demonstrate that its data management processes have been implemented?",
          options: [
            { id: "A", text: "We rely primarily on verbal explanations or informal records.", score: 1 },
            { id: "B", text: "We maintain documented procedures and relevant implementation records that can be reviewed.", score: 3 },
            { id: "C", text: "We do not retain evidence of data management activities.", score: 0 },
            { id: "D", text: "We retain some records, but they are incomplete or inconsistent.", score: 2 },
            { id: "E", text: "Not sure.", unsure: true }
          ]
        },
        {
          id: "7.9", type: "single", role: "readiness", ref: "§ 8.5; readiness indicator",
          showIf: { question: "7.1", is: ["C"] },
          topic: "Plan for a data management process",
          text: "What is your company's current plan for establishing a documented AI data management process?",
          options: [
            { id: "A", text: "We are evaluating possible approaches but have not made a decision.", readiness: "Evaluating approaches" },
            { id: "B", text: "We have no plans to establish a formal process.", readiness: "No plans" },
            { id: "C", text: "We have approved a plan but have not started implementation.", readiness: "Plan approved, not started" },
            { id: "D", text: "We are currently implementing a formal process.", readiness: "Implementation under way" },
            { id: "E", text: "Not sure.", readiness: "Unknown", unsure: true }
          ]
        }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "deployment",
        part: "C",
        number: 9,
        entry: null,
        title: "Deployment & Third-Party Management",
        intro: "Identifying and tracing released versions, supporting users, and controlling what external suppliers provide.",
        questions: [
          {
            id: "9.01", type: "single", ref: "§ 9.1", providerOnlySkip: true,
            topic: "Unique identification of released versions",
            text: "Can each AI system be identified by a unique name, version or reference when it is released?",
            options: YES_NO
          },
          {
            id: "9.02", type: "single", ref: "§ 9.1", providerOnlySkip: true,
            topic: "Traceability of supply",
            text: "Can your company trace where each released AI system was supplied?",
            help: "If the system has not been released yet, answer for whether the arrangements are in place.",
            options: YES_NO
          },
          {
            id: "9.03", type: "single", norm: "recommended", ref: "§ 9.2", providerOnlySkip: true,
            topic: "Support for deployers and users",
            text: "Has the company identified appropriate support services and channels for organisations using the AI system (deployers) and users?",
            options: YES_NO
          },
          {
            id: "9.04", type: "single", norm: "recommended", ref: "§ 9.2(f)", providerOnlySkip: true,
            topic: "Deployer reporting of concerns",
            text: "Can organisations using your AI system report concerns about risks to health, safety or fundamental rights?",
            options: YES_NO
          },
          {
            id: "9.SUP", type: "single", role: "context", source: "Assessment design — decides whether supplier questions apply",
            topic: "External suppliers",
            text: "Does this AI system rely on products, software components, data or services from external suppliers — for example pre-trained models, cloud services, datasets or labelling services?",
            options: [
              { id: "A", text: "Yes — including ongoing supplier relationships", label: "Yes, ongoing" },
              { id: "B", text: "Yes — one-off supply only", label: "Yes, one-off only" },
              { id: "C", text: "No", label: "No" },
              { id: "D", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "9.05", type: "single", ref: "§ 9.3.1", gate: true,
            showIf: { question: "9.SUP", not: ["C"] },
            skipReason: "No externally supplied products, components, data or services.",
            topic: "Controls for externally supplied items",
            text: "Does your company have controls for products, software components, data and services supplied by third parties?",
            options: YES_NO
          },
          {
            id: "9.06", type: "single", ref: "§ 9.3.2",
            showIf: { question: "9.05", not: ["B"] },
            topic: "Risk-based supplier selection criteria",
            text: "Does your company use documented criteria to assess and select suppliers based on the risks of the AI system?",
            options: YES_NO
          },
          {
            id: "9.07", type: "single", ref: "§ 9.3.3",
            showIf: [{ question: "9.05", not: ["B"] }, { question: "9.SUP", not: ["B", "C"] }],
            skipReason: "Applies only to continuing supplier relationships.",
            topic: "Periodic supplier review",
            text: "Does your company regularly review suppliers using documented criteria?",
            options: YES_PARTLY_NO
          },
          {
            id: "9.08", type: "single", ref: "§ 9.3.3",
            showIf: [{ question: "9.05", not: ["B"] }, { question: "9.SUP", not: ["B", "C"] }],
            skipReason: "Applies only to continuing supplier relationships.",
            topic: "Records of supplier evaluations",
            text: "Are supplier evaluation results and required actions retained?",
            options: YES_NO
          },
          {
            id: "9.09", type: "single", ref: "§ 9.3.4",
            showIf: { question: "9.05", not: ["B"] },
            topic: "Requirements communicated to suppliers",
            text: "Are applicable requirements and specifications communicated to external suppliers?",
            options: YES_NO
          },
          {
            id: "9.10", type: "single", ref: "§ 9.3.5",
            showIf: { question: "9.05", not: ["B"] },
            topic: "Documented supplier controls",
            text: "Are controls over suppliers and externally supplied items documented?",
            options: YES_NO
          },
          {
            id: "9.11", type: "single", ref: "§ 9.3.5(d)",
            showIf: { question: "9.05", not: ["B"] },
            topic: "Acceptance checks for supplied items",
            text: "Does your company decide which checks or tests are needed before accepting externally supplied components, data or services?",
            options: YES_NO
          },
          {
            id: "9.R", type: "single", role: "readiness", ref: "§ 9.3; readiness indicator",
            showIf: { question: "9.05", is: ["B"] },
            topic: "Plan for supplier controls",
            text: "Are you planning to establish controls for externally supplied items?",
            options: PLAN
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "monitoring",
        part: "C",
        number: 10,
        entry: null,
        providerOnlySkip: true,
        title: "Monitoring, Incidents & Corrective Actions",
        intro: "Controlling modifications, post-market monitoring, serious incidents, non-compliance and retirement.",
        questions: [
          {
            id: "10.01", type: "single", ref: "§ 9.4", gate: true,
            topic: "Modification control process",
            text: "Is there a documented process to manage and control modifications to AI systems?",
            options: YES_NO
          },
          {
            id: "10.02", type: "single", ref: "§ 9.4",
            showIf: { question: "10.01", not: ["B"] },
            topic: "Risk review of modifications",
            text: "Are the consequences of AI system modifications reviewed through the risk management process?",
            options: YES_NO
          },
          {
            id: "10.MOD", type: "single", role: "context", source: "Assessment design — decides which modification questions apply",
            showIf: { question: "P13A", not: ["A"] },
            skipReason: NOT_RELEASED,
            topic: "Modified since release",
            text: "Has this AI system been modified since it was placed on the market or put into service?",
            options: [
              { id: "A", text: "Yes — including at least one modification assessed as substantial", label: "Yes, incl. substantial" },
              { id: "B", text: "Yes — non-substantial modifications only", label: "Yes, non-substantial only" },
              { id: "C", text: "Yes — not yet determined whether substantial", label: "Yes, not yet assessed" },
              { id: "D", text: "No", label: "No" },
              { id: "E", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "10.03", type: "single", ref: "§ 9.4",
            showIf: [{ question: "10.MOD", not: ["D"] }, { question: "10.01", not: ["B"] }],
            skipReason: "Applies once the released AI system has been modified.",
            topic: "Assessing whether modifications are substantial",
            text: "Are post-release modifications assessed to determine whether they are substantial?",
            options: YES_NO
          },
          {
            id: "10.04", type: "single", ref: "§ 9.4",
            showIf: [{ question: "10.MOD", not: ["D"] }, { question: "10.01", not: ["B"] }],
            skipReason: "Applies once the AI system has been modified.",
            topic: "Rationale for modification decisions",
            text: "Is the rationale for substantial or non-substantial modification decisions documented?",
            options: YES_NO
          },
          {
            id: "10.05", type: "single", ref: "§ 9.4",
            showIf: [{ question: "10.MOD", is: ["A"] }, { question: "10.01", not: ["B"] }],
            skipReason: "Applies only after a substantial modification.",
            topic: "New conformity assessment after substantial modification",
            text: "Where a modification is substantial, is a new conformity assessment performed and the quality management system updated?",
            options: YES_NO
          },
          {
            id: "10.R1", type: "single", role: "readiness", ref: "§ 9.4; readiness indicator",
            showIf: { question: "10.01", is: ["B"] },
            topic: "Plan for controlling modifications",
            text: "Are you planning to establish a documented process for controlling modifications?",
            options: PLAN
          },
          {
            id: "10.06P", type: "single", role: "readiness", ref: "§ 9.5.1; readiness indicator",
            showIf: { question: "P13A", is: ["A"] },
            topic: "Post-market monitoring prepared before release",
            text: "Is a post-market monitoring plan being prepared, ready for when the AI system is released?",
            options: [
              { id: "A", text: "Yes — a plan is drafted or approved", readiness: "Plan drafted or approved" },
              { id: "B", text: "Planned, not started", readiness: "Planned, not started" },
              { id: "C", text: "No", readiness: "Not prepared" },
              { id: "D", text: "Not sure", readiness: "Unknown", unsure: true }
            ]
          },
          {
            id: "10.06", type: "single", ref: "§ 9.5.1", gate: true,
            showIf: { question: "P13A", not: ["A"] },
            skipReason: NOT_RELEASED,
            topic: "Post-market monitoring system",
            text: "Is a post-market monitoring system documented for each released AI system?",
            options: YES_NO
          },
          {
            id: "10.07", type: "single", ref: "§ 9.5.1",
            showIf: { question: "10.06", not: ["B"] },
            skipReason: NOT_RELEASED,
            topic: "Monitoring from release until retirement",
            text: "Does the post-market monitoring plan cover the period from release until retirement?",
            options: YES_NO
          },
          {
            id: "10.08", type: "single", ref: "§ 9.5.2",
            showIf: { question: "10.06", not: ["B"] },
            skipReason: NOT_RELEASED,
            topic: "Scope of post-market monitoring",
            text: "Does the monitoring approach consider risks, misuse, privacy, performance, third-party dependencies and relevant interactions?",
            options: YES_NO
          },
          {
            id: "10.09", type: "single", ref: "§ 9.5.3",
            showIf: { question: "10.06", not: ["B"] },
            skipReason: NOT_RELEASED,
            topic: "Sources of monitoring data",
            text: "Are monitoring results systematically gathered from organisations using the AI system (deployers), logs, authorities, complaints and incidents?",
            options: YES_NO
          },
          {
            id: "10.10", type: "single", ref: "§ 9.5.4",
            showIf: { question: "10.06", not: ["B"] },
            skipReason: NOT_RELEASED,
            topic: "New or emerging hazards",
            text: "Are procedures in place to identify and act on new or emerging hazards?",
            options: YES_NO
          },
          {
            id: "10.R2", type: "single", role: "readiness", ref: "§ 9.5; readiness indicator",
            showIf: { question: "10.06", is: ["B"] },
            topic: "Plan for post-market monitoring",
            text: "Are you planning to establish a post-market monitoring system?",
            options: PLAN
          },
          {
            id: "10.DEP", type: "single", role: "context", source: "Assessment design — decides whether 10.11 applies",
            showIf: { question: "P13A", not: ["A"] },
            skipReason: NOT_RELEASED,
            topic: "Monitoring depends on deployers",
            text: "Does monitoring of this AI system depend partly on organisations using it (deployers)?",
            options: CONTEXT_YN
          },
          {
            id: "10.11", type: "single", ref: "§ 9.5.5",
            showIf: { question: "10.DEP", not: ["B"] },
            skipReason: "Monitoring does not depend on deployers, or the system has not been released.",
            topic: "Deployer monitoring in instructions for use",
            text: "Where monitoring depends on organisations using the AI system (deployers), do instructions for use specify monitoring requirements and necessary competence?",
            options: YES_NO
          },
          {
            id: "10.12", type: "single", ref: "§ 9.6.1",
            topic: "Investigating serious incidents",
            text: "Are serious incidents investigated for a causal or reasonably plausible link to the AI system?",
            help: NO_INCIDENT_HELP,
            options: YES_NO
          },
          {
            id: "10.13", type: "single", ref: "§§ 9.6.1–9.6.2",
            topic: "Reporting serious incidents to authorities",
            text: "Are serious incidents reported to competent authorities within applicable reporting deadlines?",
            help: NO_INCIDENT_HELP + " Under Article 73 of the EU AI Act, deadlines are generally 15 days after becoming aware, and shorter in some cases.",
            options: YES_NO
          },
          {
            id: "10.14", type: "single", ref: "§ 9.6.2.1",
            topic: "Deployer incident reporting and suspension of use",
            text: "Do procedures allow organisations using the AI system (deployers) to report serious incidents and suspend use when necessary?",
            options: YES_NO
          },
          {
            id: "10.15", type: "single", norm: "recommended", ref: "§ 9.6.2.2",
            topic: "Incident records",
            text: "Are incidents, investigations, findings and actions documented?",
            options: YES_NO
          },
          {
            id: "10.16", type: "single", ref: "§ 9.7.1",
            topic: "Detecting non-compliance",
            text: "Are procedures in place to detect AI systems that no longer comply with applicable requirements?",
            options: YES_NO
          },
          {
            id: "10.NC", type: "single", role: "context", source: "Assessment design — decides which corrective-action questions apply",
            topic: "Non-compliance identified",
            text: "Has your company found that this AI system did not meet applicable requirements at any point?",
            options: [
              { id: "A", text: "Yes", label: "Yes" },
              { id: "B", text: "Yes — and it presented a risk to health, safety or fundamental rights", label: "Yes, presenting a risk" },
              { id: "C", text: "No", label: "No" },
              { id: "D", text: "Not sure", label: "Not sure", unsure: true }
            ]
          },
          {
            id: "10.17", type: "single", ref: "§ 9.7.1",
            showIf: { question: "10.NC", is: ["A", "B"] },
            skipReason: "No non-compliance has been identified.",
            topic: "Assessing non-compliance",
            text: "When failure to meet applicable requirements occurs, are its extent, causes and potential effect on other systems assessed?",
            options: YES_NO
          },
          {
            id: "10.18", type: "single", ref: "§ 9.7.1",
            showIf: { question: "10.NC", is: ["A", "B"] },
            skipReason: "No non-compliance has been identified.",
            topic: "Corrective action",
            text: "Are appropriate corrective actions taken, including bringing the system into compliance, withdrawal, disabling or recall?",
            options: YES_NO
          },
          {
            id: "10.19", type: "single", ref: "§ 9.7.1",
            showIf: { question: "10.18", is: ["A"] },
            skipReason: "Applies once corrective action has been taken.",
            topic: "Effectiveness of corrective action",
            text: "Is the effectiveness of corrective action reviewed and are recurring issues analysed?",
            options: YES_NO
          },
          {
            id: "10.20", type: "single", ref: "§§ 9.7.1–9.7.2",
            showIf: { question: "10.NC", is: ["B"] },
            skipReason: "No non-compliance presenting a risk has been identified.",
            topic: "Informing authorities and operators about risks",
            text: "Are competent authorities and relevant operators informed when required about AI systems presenting a risk?",
            options: YES_NO
          },
          {
            id: "10.21", type: "single", ref: "§ 9.7.3",
            showIf: { question: "10.NC", is: ["A", "B"] },
            skipReason: "No non-compliance has been identified.",
            topic: "Records of non-compliance and corrective action",
            text: "Are failure to meet applicable requirements findings and corrective-action results retained?",
            options: YES_NO
          },
          {
            id: "10.22", type: "single", ref: "§ 8.6",
            topic: "Retirement procedures",
            text: "Is AI system retirement managed through documented lifecycle procedures?",
            options: YES_NO
          }
        ]
      },

      /* ------------------------------------------------------------------ */
      {
        id: "documentation",
        part: "C",
        number: 11,
        entry: null,
        title: "Documentation & Traceability",
        intro: "QMS documentation and document control, system identification, technical documentation, instructions for use and logging.",
        questions: [
          {
            id: "11.01", type: "single", ref: "§ 4.5.1", gate: true,
            topic: "QMS documentation",
            text: "Is quality management system documentation established and maintained to demonstrate compliance with the standard?",
            options: YES_NO
          },
          {
            id: "11.02", type: "single", ref: "§ 4.5.1",
            showIf: { question: "11.01", not: ["B"] },
            topic: "Content of QMS documentation",
            text: "Does quality management system documentation describe scope, quality policy, objectives, procedures and their interactions?",
            options: YES_NO
          },
          {
            id: "11.03", type: "single", ref: "§ 4.5.1",
            showIf: { question: "11.01", not: ["B"] },
            topic: "Accessible, version-controlled documentation",
            text: "Is quality management system documentation clear, accessible, version-controlled and readily retrievable?",
            options: YES_NO
          },
          {
            id: "11.R1", type: "single", role: "readiness", ref: "§ 4.5.1; readiness indicator",
            showIf: { question: "11.01", is: ["B"] },
            topic: "Plan for QMS documentation",
            text: "Are you planning to establish quality management system documentation?",
            options: PLAN
          },
          {
            id: "11.04", type: "single", ref: "§ 4.5.2",
            topic: "Operational documents",
            text: "Are operational documents maintained where needed for effective quality management system planning and control?",
            options: YES_NO
          },
          {
            id: "11.05", type: "single", ref: "§ 4.5.3",
            topic: "Review and approval of document changes",
            text: "Are changes to documented information reviewed and approved by competent personnel?",
            options: YES_NO
          },
          {
            id: "11.06", type: "single", ref: "§ 4.5.4.1",
            topic: "Document control",
            text: "Are documents controlled for access, protection, preservation, changes, retention and disposal?",
            options: YES_NO
          },
          {
            id: "11.07", type: "single", ref: "§ 4.5.4.1",
            topic: "Retention periods",
            text: "Are retention periods defined and applied in accordance with regulatory requirements and system lifetime?",
            options: YES_NO
          },
          {
            id: "11.08", type: "single", ref: "§ 4.5.4.2",
            topic: "Externally sourced documents",
            text: "Are externally sourced documents needed for the quality management system identified and controlled?",
            options: YES_NO
          },
          {
            id: "11.09", type: "single", ref: "§ 4.5.4.3",
            topic: "Document approval and revision procedures",
            text: "Are procedures documented for approval, updating, reapproval and revision control of documents?",
            options: YES_NO
          },
          {
            id: "11.10", type: "single", ref: "§ 8.7", providerOnlySkip: true,
            topic: "Unique system reference",
            text: "Does each AI system have a unique reference enabling identification and traceability?",
            options: YES_NO
          },
          {
            id: "11.11", type: "single", ref: "§ 8.9.2", gate: true, providerOnlySkip: true,
            topic: "Technical documentation before release",
            text: "Is technical documentation established for each AI system before it is placed on the market or put into service?",
            help: "If the system hasn’t been released yet, answer for whether technical documentation is being established ahead of release.",
            options: YES_NO
          },
          {
            id: "11.12", type: "single", ref: "§ 8.9.2", providerOnlySkip: true,
            showIf: { question: "11.11", not: ["B"] },
            topic: "Content of technical documentation",
            text: "Does technical documentation describe the system, its components and development sufficiently to demonstrate applicable compliance?",
            options: YES_NO
          },
          {
            id: "11.13", type: "single", ref: "§ 8.9.2", providerOnlySkip: true,
            showIf: [{ question: "10.MOD", not: ["D"] }, { question: "11.11", not: ["B"] }],
            skipReason: "Applies once the released AI system has been modified.",
            topic: "Updating technical documentation after modifications",
            text: "Is technical documentation updated when system modifications affect regulatory requirements?",
            options: YES_NO
          },
          {
            id: "11.16", type: "single", ref: "§ 9.4", providerOnlySkip: true,
            showIf: { question: "11.11", not: ["B"] },
            topic: "Technical documentation across versions",
            text: "Does technical documentation reflect all AI system versions?",
            options: YES_PARTLY_NO
          },
          {
            id: "11.R2", type: "single", role: "readiness", ref: "§ 8.9.2; readiness indicator", providerOnlySkip: true,
            showIf: { question: "11.11", is: ["B"] },
            topic: "Plan for technical documentation",
            text: "Are you planning to establish technical documentation for this AI system?",
            options: PLAN
          },
          {
            id: "11.14", type: "single", ref: "§ 8.9.3", providerOnlySkip: true,
            topic: "Instructions for use",
            text: "Are procedures established to prepare and maintain instructions for use for each AI system?",
            options: YES_NO
          },
          {
            id: "11.15", type: "single", ref: "§ 9.5.3", providerOnlySkip: true,
            showIf: { question: "P13A", not: ["A"] },
            skipReason: NOT_RELEASED,
            topic: "Logging for post-market monitoring",
            text: "Does the company implement appropriate logging to support post-market monitoring?",
            options: YES_NO
          }
        ]
      }
    ]
  };
})();
