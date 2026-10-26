/* ==========================================================================
   AI SAFETY INDICATOR — configuration
   All mappings, weights and texts for the AI Safety Indicator live here.
   Edit this file to change the indicator; no other file needs to change.

   HOW IT WORKS (logic lives in app.js and reads this file)
   - Each topic lists the questions / options that help address it ("tags"):
       "5.7": 0.6     → whole question 5.7 (single-choice), weight 0.6
       "5.3B": 1.0    → option B of question 5.3 ("select all"), weight 1.0
     Weights: 1.0 = directly targets the topic, 0.6 = partly addresses it,
     0.3 = indirectly helps. Remove a line to untag; add a line to tag.
   - Each answer becomes a maturity value from 0 to 1 using the existing
     answer scale (absent 0, informal 1/3, partial 2/3, established 1).
     "Select all" options: ticked = 1, not ticked = 0 (applicable options only).
   - Per topic: weighted maturity = sum(weight × maturity) / sum(weight),
     internal value = round(100 × (1 − weighted maturity)) → level below.
     The internal value is never shown.
   - Excluded: "Not applicable" answers, options marked N/A, and anything the
     existing logic treats as provider-only for deployers.
   - "Not sure" answers are excluded and listed as unknowns.
   - Questions skipped because the respondent said no process exists count as
     absent (maturity 0), the same way the existing results count them.
   - "Limited information" and "Indication based on N of your answers" count
     distinct questions, not individual options.

   WORDING RULE: this is an indication to raise awareness — not an assessment,
   score or rating. Keep "indicative", "may", "suggests". Never "your risk is",
   "assessed", "compliant" or "certified".
   ========================================================================== */

window.SAFETY = {
  enabled: true,

  title: "AI Safety Indicator",
  intro: "An indication of how far seven AI safety topics appear to be addressed, derived from the same answers.",
  notice: "Indicative only. This highlights AI safety topics that your answers suggest may be less addressed by your current processes. It is not a risk assessment, does not measure how risky your AI system is, and is not legal advice.",

  // Internal value (never displayed) → label. Checked in order; first match wins.
  levels: [
    { max: 25,  label: "Lower indication",    segments: 1 },
    { max: 50,  label: "Moderate indication", segments: 2 },
    { max: 75,  label: "Elevated indication", segments: 3 },
    { max: 100, label: "Strong indication",   segments: 4 }
  ],
  scaleCaption: "How strongly your answers suggest a topic may be less addressed by your current processes",

  // Fewer distinct questions than this → "limited information" note. 0 → no indication.
  minQuestions: 2,

  texts: {
    summaryTwo: "Your answers suggest the areas most worth looking at are {1} and {2}.",
    summaryOne: "Your answers suggest the area most worth looking at is {1}.",
    summaryAllLower: "Your answers suggest these topics appear broadly addressed by your current processes. The relatively less addressed ones are {1} and {2}.",
    summaryOneLower: "Your answers suggest these topics appear broadly addressed by your current processes. The relatively less addressed one is {1}.",
    summaryMany: "Your answers suggest the areas most worth looking at are {list}.",
    summaryManyLower: "Your answers suggest these topics appear broadly addressed by your current processes. The relatively less addressed ones are {list}.",
    summaryManyTied: "Your answers suggest several topics share a similar level ({level}); the details below show what drives each.",
    summaryEven: "Your answers suggest a similar level across all topics ({level}).",
    summaryNone: "Your answers don't give enough information for an indication on any topic.",
    limited: "Limited information, very indicative",
    noIndication: "No indication available",
    whatItIs: "What it is",
    suggests: "What your answers suggest",
    suggestsEmpty: "None of your answers on this topic point to a gap.",
    helps: "What helps",
    helpsEmpty: "None of your answers on this topic were at a defined or established level.",
    unknowns: "Unknowns",
    unknownsNote: "Uncertainty here may itself be worth looking into.",
    lookNext: "Where to look next",
    lookNextPrefix: "EN 18286",
    basedOn: "Indication based on {n} of your answers.",
    basedOnOne: "Indication based on 1 of your answers.",
    inferred: "This includes {m} question(s) skipped because you indicated no established process is in place; these are counted as not addressed.",
    indicated: "You indicated that {text}",
    skipped: "there is no established process in this area, so “{label}” is not covered",
    notCoveredTitle: "Not covered by this check"
  },

  // Short labels used in the indicator (kept separate from the question
  // wording so the indicator's vocabulary can follow the wording rule).
  labels: {
    "5.2": "Lifecycle stages where risks are examined",
    "5.3": "Types of harm considered",
    "5.7": "Involvement of affected persons",
    "5.8": "Events that prompt a fresh look at risks",
    "7.2": "Data types covered",
    "7.3": "Data management activities covered",
    "7.4": "Data requirements per AI system",
    "7.5": "Regulatory compliance of data practices",
    "7.6": "Data management across development",
    "7.7": "Data decommissioning",
    "7.8": "Evidence of data management",
    "8.2": "Verification against specifications",
    "8.3": "Verification test plans",
    "8.4": "Testing conditions documented for reproducibility",
    "8.5": "Validation against intended purpose",
    "8.6": "Timing of validation",
    "8.7": "Acceptance criteria for test results",
    "8.8": "Residual risk evaluation after validation",
    "8.9": "Recording test results and corrective action"
  },

  // Sentences for "select all" options. {option} = option text as written,
  // {option_lc} = same with a lower-case first letter.
  phrases: {
    "5.2": { missing: "risks are not examined at the “{option}” stage",           has: "risks are examined at the “{option}” stage" },
    "5.3": { missing: "your risk process does not consider {option_lc}",          has: "your risk process considers {option_lc}" },
    "5.8": { missing: "“{option}” is not among the events that prompt a fresh look at risks", has: "“{option}” prompts a fresh look at risks" },
    "7.2": { missing: "{option_lc} is not covered by your data management processes", has: "{option_lc} is covered by your data management processes" },
    "7.3": { missing: "{option_lc} is not covered by your documented data procedures", has: "{option_lc} is covered by your documented data procedures" },
    "8.3": { missing: "your verification test plans do not cover {option_lc}",    has: "your verification test plans cover {option_lc}" },
    "8.4": { missing: "you do not document {option_lc} for reproducibility",      has: "you document {option_lc} for reproducibility" },
    "8.6": { missing: "you do not validate {option_lc}",                          has: "you validate {option_lc}" }
  },

  topics: [
    {
      id: "bias",
      title: "Bias and discrimination",
      what: "The system may treat groups of people unfairly.",
      tags: {
        "5.3B":   1.0,  // Non-discrimination is a fundamental right; puts discriminatory harm explicitly in scope
        "5.3E":   0.6,  // Societal/economic interference covers unfair treatment of groups, but more broadly
        "5.7":    0.6,  // Consulting affected groups is a main route to spotting unfair treatment
        "7.4":    0.6,  // Defined data requirements are where representativeness/relevance gets set
        "7.3D":   0.6,  // Labelling is a major source of encoded bias
        "7.3C":   0.6,  // Data analysis is where bias examination happens (cf. AI Act Art. 10)
        "7.3B":   0.3,  // Collection choices shape who is represented
        "7.3E":   0.3,  // Filtering can silently drop groups
        "7.2A":   0.3,  // Training data under management is a precondition for checking it
        "7.2C":   0.3,  // Managed testing data is needed to test across groups
        "8.5":    0.3   // Validation in the intended context can surface uneven performance
      }
    },
    {
      id: "hallucination",
      title: "Hallucination / incorrect outputs",
      what: "The system may produce confident but wrong outputs.",
      tags: {
        "8.7":    1.0,  // Acceptance limits define how much error is tolerated
        "8.3D":   0.6,  // Numerical limits in test plans make accuracy checkable
        "8.5":    0.6,  // Validation checks outputs are fit for the intended purpose
        "8.2":    0.6,  // Verification against specs catches outputs outside specified behaviour
        "5.8B":   0.6,  // Monitoring/complaints/incidents is how wrong outputs surface in operation
        "8.3A":   0.3,  // Tests tied to intended purpose target the outputs that matter
        "8.6C":   0.3,  // Validating before release reduces wrong outputs reaching users
        "8.9":    0.3,  // Corrective action closes errors found in testing
        "5.2D":   0.3,  // Risk assessment during operation can pick up output errors
        "7.4":    0.3,  // Data quality requirements underpin output accuracy
        "7.2C":   0.3   // Managed testing data supports meaningful accuracy testing
      }
    },
    {
      id: "robustness",
      title: "Robustness and drift",
      what: "Performance may degrade on new, unusual or changing inputs.",
      tags: {
        "5.8C":   1.0,  // Changes to the operating environment are the classic drift trigger
        "5.8A":   0.6,  // Updates/retraining can shift behaviour
        "5.8B":   0.6,  // Monitoring signals are how degradation is noticed
        "5.8D":   0.6,  // Periodic review catches slow, gradual drift
        "5.2D":   0.6,  // Assessing risk during operation is where drift shows up
        "7.2E":   0.6,  // Managing input data is how distribution shift is detected
        "7.2D":   0.6,  // Logs are the evidence base for monitoring
        "5.2E":   0.3,  // Reassessing at modification touches behaviour change
        "8.3B":   0.3,  // Misuse testing exercises unusual inputs
        "8.3E":   0.3,  // Reproducible tests allow before/after comparison
        "8.4E":   0.3,  // Versioned datasets make it possible to compare against new data
        "8.5":    0.3   // Validation under intended conditions sets a baseline
      }
    },
    {
      id: "misuse",
      title: "Misuse",
      what: "The system may be used, intentionally or not, outside its intended purpose.",
      tags: {
        "8.3B":   1.0,  // Directly tests reasonably foreseeable misuse
        "8.5":    0.6,  // Validation against instructions for use defines the intended boundaries
        "5.8C":   0.6,  // Changes to intended purpose trigger reassessment
        "8.3A":   0.3,  // Testing against intended purpose makes out-of-scope use visible
        "5.8B":   0.3,  // Misuse tends to surface through complaints and incidents
        "5.2A":   0.3,  // Risk assessment at inception is where intended purpose and misuse are first framed
        "5.2D":   0.3   // Operational risk assessment can catch use drifting from purpose
      }
    },
    {
      id: "privacy",
      title: "Privacy and data leakage",
      what: "Personal data may be exposed through training data or outputs.",
      tags: {
        "7.5":    0.6,  // Regulatory compliance of data practices (GDPR above all), but broader than privacy
        "7.7":    0.6,  // Destruction/archiving limits exposure of data no longer needed
        "7.3G":   0.6,  // Retention procedures limit how long personal data is held
        "7.3H":   0.6,  // Storage procedures govern access and protection
        "7.2D":   0.6,  // Logs often contain personal data
        "7.2E":   0.6,  // User inputs often contain personal data
        "7.3A":   0.3,  // Acquisition is where lawful basis/provenance is set
        "7.3B":   0.3,  // Collection scope determines how much personal data enters
        "7.2A":   0.3,  // Training data under management is a precondition for privacy controls
        "5.3B":   0.3,  // Privacy and data protection are fundamental rights
        "7.8":    0.3   // Records make privacy controls demonstrable
      }
    },
    {
      id: "poisoning",
      title: "Data poisoning and supply-chain integrity",
      what: "Training data or third-party components may be corrupted or untraceable.",
      tags: {
        "8.4E":   1.0,  // Dataset versions and preprocessing steps = data provenance/traceability
        "8.4B":   1.0,  // Documented framework/library versions = third-party component traceability
        "7.3A":   0.6,  // Acquisition procedures govern third-party data sources
        "7.3B":   0.6,  // Collection procedures govern data origin
        "7.3E":   0.6,  // Filtering is where corrupted or malicious data can be removed
        "7.8":    0.6,  // Implementation records support traceability
        "7.3D":   0.3,  // Labelling is a known poisoning vector
        "7.3C":   0.3,  // Analysis can spot anomalous data
        "7.6":    0.3,  // Consistent data handling across the lifecycle reduces untracked changes
        "7.4":    0.3   // Defined requirements give a reference to check incoming data against
      }
    },
    {
      id: "specgaming",
      title: "Specification gaming / misalignment",
      what: "The system may optimise a proxy instead of the real goal \u2014 for example, passing verification against its specifications while failing validation against its intended purpose.",
      tags: {
        "8.5":    1.0,  // Validation against intended purpose is what exposes passing-the-spec-but-missing-the-goal
        "8.3A":   0.6,  // Tying verification to intended purpose, not only specs, narrows the proxy gap
        "8.8":    0.6,  // Residual risk evaluation from validation results forces a look at goal fit
        "8.6A":   0.3,  // Validating during development catches proxy optimisation early
        "8.6B":   0.3,  // Validation after development checks the finished system against purpose
        "8.6C":   0.3,  // Validation before release is the last check on goal fit
        "8.7":    0.3,  // Acceptance criteria help, but can themselves be proxies
        "5.7":    0.3,  // Affected persons can reveal mismatch between proxy and real goal
        "5.8B":   0.3,  // Complaints/incidents reveal real-world goal failures
        "5.2D":   0.3   // Operational risk assessment can catch goal mismatch in use
      }
    }
  ],

  // Shown without any level, one sentence each on why it matters.
  notCovered: [
    { title: "Human oversight and automation bias", ref: "AI Act Art. 14",
      text: "People overseeing an AI system can come to over-trust its outputs; effective oversight depends on design, training and the authority to intervene." },
    { title: "Security: adversarial attacks and prompt injection", ref: "AI Act Art. 15",
      text: "Crafted inputs can make a system misbehave or leak information, so resilience to attack needs its own testing and controls." },
    { title: "Autonomy and loss of control in agentic systems",
      text: "Systems that plan and act with less human involvement can take consequential actions that are hard to anticipate, monitor or reverse." },
    { title: "Uncertainty and grounding of outputs",
      text: "A system can give fluent answers with no signal of how reliable they are; the questions here cover accuracy testing in general, not this." },
    { title: "Personal data revealed through outputs",
      text: "Models can reproduce personal data they were trained on; the questions here cover how data is managed, not what a model may disclose." },
    { title: "Due diligence on third-party models and suppliers",
      text: "Pre-trained models and vendors bring their own data and design choices; the questions here cover version traceability, not supplier vetting." }
  ]
};
