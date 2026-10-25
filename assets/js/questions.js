/* ==========================================================================
   ASSESSMENT CONTENT — this is the only file you need to edit to change
   questions, answers, branching or scoring. See README.md for a guide.

   QUICK REFERENCE
   ---------------
   Question fields
     id        Unique, stable id (e.g. "5.2"). Used in share links, so don't
               reuse an id for a different question.
     type      "single" (one answer) or "multi" (select all that apply)
     role      "readiness" = planning question, shown in results as a status,
               not scored. Leave out for normal scored questions.
     text      The question shown to users.
     topic     Short label used in the results / gap list.
     help      Optional helper line shown under the question.
     ref       Clause reference (shown in the results only, never in the test;
               turn off with settings.showClauseRefsInResults).
     showIf    Branching. { question: "5.1", not: ["B"] } = show unless 5.1 is B.
                          { question: "5.1", is:  ["B"] } = show only if 5.1 is B.
               If the referenced question is answered "Not applicable", the
               dependent questions are skipped automatically.
     providerOnly  true = an activity only a provider controls. Deployer-only
               respondents get an automatic "Not applicable" answer instead of
               failing it (wording: settings.providerNAText).
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
     providerOnly  Option hidden for deployer-only respondents (multi-choice).
     exclusive Ticking it clears the others (e.g. "None", "Not sure").
     unsure    "Not sure" — left out of the score and reported separately as
               "not verified" (it is not counted as non-compliance).
     na        "Not applicable" — left out of the score, reported separately.
     readiness Label shown in results for readiness questions.

   If you change what an existing answer MEANS, bump `version` below so old
   share links show a "this link was made with an older version" notice.

   Chapters with `scope: true` hold context questions (role: "context"):
   they set applicability and are never scored.
   ========================================================================== */

window.ASSESSMENT = {
  version: 2,

  settings: {
    siteName: "EN 18286 Readiness Check",
    standard: "FprEN 18286:2026 — Artificial Intelligence: Quality Management System for EU AI Act Regulatory Purposes",
    standardShort: "FprEN 18286:2026",
    showClauseRefsInResults: true,

    // Applicability: which answer to the role question means "deployer only".
    roleQuestion: "0.1",
    deployerOnlyAnswers: ["B"],
    providerNAText: "Not applicable — this activity is carried out by the provider of our AI system.",

    // A score is labelled "provisional" when at least this share of the
    // applicable answers is "Not sure".
    provisionalThreshold: 0.25,

    // Notices shown in the results when a condition is met. Use these to flag
    // areas the assessment doesn't cover yet.
    coverageNotes: [
      {
        showIf: { question: "0.2", not: ["B"] },
        title: "Not yet covered: continuous-learning AI systems",
        text: "AI systems that continue to learn after being placed on the market or put into service are subject to additional requirements, including verification and validation of predetermined changes. This assessment does not cover them yet.",
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
      title: "Scope",
      intro: "Two questions about your organisation and its AI systems. They decide which requirements apply to you.",
      questions: [
        {
          id: "0.1", type: "single", role: "context",
          topic: "Role",
          text: "What is your organisation's role for the high-risk AI systems in scope?",
          help: "FprEN 18286 is written mainly for providers. Deployers are not marked down for activities their provider controls.",
          options: [
            { id: "A", text: "Provider — we develop AI systems, or have them developed, and place them on the market or put them into service under our name.", label: "Provider" },
            { id: "B", text: "Deployer — we use AI systems supplied by another organisation and do not develop or substantially modify them.", label: "Deployer" },
            { id: "C", text: "Both — we provide some AI systems and deploy others.", label: "Provider and deployer" },
            { id: "D", text: "Not sure.", label: "Not sure (assessed as provider)", unsure: true }
          ]
        },
        {
          id: "0.2", type: "single", role: "context",
          topic: "Continuous learning",
          text: "Do any of the AI systems in scope continue to learn after they are placed on the market or put into service?",
          options: [
            { id: "A", text: "Yes", label: "Yes" },
            { id: "B", text: "No", label: "No" },
            { id: "C", text: "Not sure.", label: "Not sure", unsure: true }
          ]
        }
      ]
    },

    /* ------------------------------------------------------------------ */
    {
      id: "risk",
      number: 5,
      title: "AI Risk Management & Fundamental Rights",
      intro: "How your organisation identifies, assesses, controls and revisits risks from its AI systems, including risks to fundamental rights.",
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
        }
      ]
    },

    /* ------------------------------------------------------------------ */
    {
      id: "data",
      number: 7,
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
      id: "testing",
      number: 8,
      title: "Testing, Validation & Technical Safety",
      intro: "How your AI systems are verified against their specifications, validated for their intended purpose, and how results are recorded and acted on.",
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
        }
      ]
    }
  ]
};
