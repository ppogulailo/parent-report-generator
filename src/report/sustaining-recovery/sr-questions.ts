// ─────────────────────────────────────────────────────────────────────────────
// DRAFT CONTENT — Sustaining Recovery Parent Action Plan
// ─────────────────────────────────────────────────────────────────────────────
// This 20-question post-treatment intake is a SCAFFOLD draft, NOT founder-
// approved methodology. It exists so the second report type runs end-to-end.
// The real questions, domains, and anchors must be reviewed and replaced with
// founder-approved content before this plan ships. The early-intervention
// questionnaire (../prompts/questions.ts) is written for "is my child using?";
// this one is written for "my child is home from treatment — how do I hold the
// recovery line?". Same answer scale: 1 = healthiest / strongest, 4 = most
// concerning. Each label carries the direction so the parent never translates.
// ─────────────────────────────────────────────────────────────────────────────

export const SR_QUESTIONS: string[] = [
  // Relapse Risk & Safety (0–3)
  'How recently did your child complete treatment and return home?',
  'How worried are you about an immediate relapse in the first weeks home?',
  'Have you seen warning signs you associate with your child’s past use (mood shifts, secrecy, old contacts)?',
  'How accessible are substances, alcohol, or unsecured medications in or around your home?',
  // Home Environment & Triggers (4–7)
  'How much contact does your child still have with the friends or settings tied to their past use?',
  'How well does your home routine avoid the specific triggers your child identified in treatment?',
  'How aligned are caregivers/co-parents on the rules and recovery plan now that your child is home?',
  'How stable and low-conflict is the overall home environment right now?',
  // Routine & Structure (8–11)
  'How much daily structure (school/work, sleep, meals, activities) does your child currently have?',
  'How consistently are agreed rules, rewards, and consequences being followed at home?',
  'How engaged is your child in healthy activities or interests that support recovery?',
  'How clear is the aftercare plan (appointments, meetings, contacts) and how closely is it being followed?',
  // Communication & Trust (12–15)
  'How openly can your child talk with you about cravings, stress, or hard days?',
  'How much trust has been rebuilt between you and your child since treatment?',
  'How calm and non-reactive are you able to stay when recovery topics come up?',
  'How confident are you in responding to a slip or setback without escalating or giving up?',
  // Ongoing Support & Treatment Continuity (16–19)
  'How connected is your child to ongoing professional support (therapist, program, or recovery group)?',
  'How supported do you feel as the parent — peers, family, professionals you can lean on?',
  'How prepared are you with a concrete plan if a relapse or crisis happens?',
  'How informed do you feel about your child’s recovery needs and the substances involved?',
];

// Per-question behavior anchors. Index 0 = label for score 1 (strongest end),
// index 3 = label for score 4 (most concerning end).
export const SR_ANSWER_LABELS: string[][] = [
  // Q1 — time since return
  [
    'Home for several months, settled in',
    'Home for a few weeks',
    'Home only days to a week or two',
    'Returning home now / in the next few days',
  ],
  // Q2 — relapse worry
  [
    'Not particularly worried',
    'Mildly watchful',
    'Worried',
    'Very worried — I expect it could happen soon',
  ],
  // Q3 — warning signs
  [
    'None I can point to',
    'One or two small things',
    'Several familiar signs',
    'Clear signs that mirror past use',
  ],
  // Q4 — access in the home
  [
    'Nothing accessible; meds and alcohol secured',
    'Mostly secured, a few gaps',
    'Several things still accessible',
    'Substances/alcohol/meds easily within reach',
  ],
  // Q5 — old friends/settings
  [
    'No contact with old crowd or settings',
    'Occasional, supervised contact',
    'Regular contact',
    'Daily contact with the people/places tied to use',
  ],
  // Q6 — trigger-aware routine
  [
    'Routine actively avoids known triggers',
    'Mostly, with some exposure',
    'Triggers come up often',
    'Daily life is full of the old triggers',
  ],
  // Q7 — caregiver alignment
  [
    'Fully aligned on the plan',
    'Mostly aligned',
    'Often out of sync',
    'Pulling in different directions',
  ],
  // Q8 — home stability
  [
    'Calm and stable',
    'Mostly stable',
    'Frequently tense',
    'High-conflict / chaotic',
  ],
  // Q9 — daily structure
  [
    'Full, predictable daily structure',
    'Some structure',
    'Little structure',
    'Days are unstructured and drifting',
  ],
  // Q10 — rules/rewards/consequences consistency
  [
    'Followed consistently',
    'Followed most of the time',
    'Often inconsistent',
    'Rarely followed through',
  ],
  // Q11 — healthy engagement
  [
    'Strongly engaged in healthy activities',
    'Somewhat engaged',
    'Barely engaged',
    'No healthy activities or interests',
  ],
  // Q12 — aftercare clarity/adherence
  [
    'Clear plan, closely followed',
    'Clear plan, loosely followed',
    'Vague plan, rarely followed',
    'No real aftercare plan in place',
  ],
  // Q13 — open communication
  [
    'Talks openly about hard days',
    'Sometimes opens up',
    'Rarely opens up',
    'Shuts down or hides struggles',
  ],
  // Q14 — rebuilt trust
  [
    'Trust largely rebuilt',
    'Rebuilding steadily',
    'Still very fragile',
    'Little to no trust right now',
  ],
  // Q15 — parent regulation
  [
    'Calm and steady in these moments',
    'Usually steady',
    'Often reactive',
    'I escalate or panic easily',
  ],
  // Q16 — response to setbacks
  [
    'Confident I can respond steadily',
    'Fairly confident',
    'Unsure',
    'I have no idea how I’d handle it',
  ],
  // Q17 — child’s ongoing professional support
  [
    'Actively connected and attending',
    'Connected but inconsistent',
    'Loosely connected',
    'No ongoing professional support',
  ],
  // Q18 — parent’s own support
  [
    'Well supported',
    'Somewhat supported',
    'Mostly on my own',
    'Completely on my own',
  ],
  // Q19 — crisis plan
  ['Concrete plan ready', 'Rough plan', 'Only vague ideas', 'No plan at all'],
  // Q20 — parent knowledge
  [
    'Well informed about the recovery needs',
    'Fairly informed',
    'Somewhat in the dark',
    'I don’t know what to watch for',
  ],
];
