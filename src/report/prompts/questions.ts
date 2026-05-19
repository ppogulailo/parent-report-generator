export const QUESTIONS: string[] = [
  'How certain are you that your child has used drugs, alcohol, or other substances?',
  'How frequently do you suspect substance use may be occurring?',
  'Have you observed secrecy, lying, or avoidance when discussing concerns?',
  'How often does your child spend time in environments where substances may be present?',
  'How intense are conflicts between you and your child regarding behavior or rules?',
  'How confident do you feel confronting your child about substance concerns?',
  'How consistent are consequences when rules are broken?',
  'How often do you feel unsure whether you are overreacting or underreacting?',
  'Have you noticed significant mood swings, withdrawal, or aggressive behavior?',
  "How concerned are you about your child's safety (driving, risky environments, etc.)?",
  'How aligned are caregivers or co-parents in responding to the situation?',
  'How often does your child spend time with peers you consider a negative influence?',
  'How comfortable is your child discussing stress, anxiety, or emotional pain?',
  "How frequently do you monitor your child's whereabouts and activities?",
  'How supported do you feel by school staff or community professionals?',
  'Have you sought guidance from a therapist, counselor, or treatment provider?',
  'How often do you feel exhausted, fearful, or overwhelmed by the situation?',
  'How clear is your plan for next steps if substance use continues?',
  'How often does your child accept responsibility for their behavior?',
  "How much structure currently exists in your child's daily routine?",
  'How confident are you that your home environment discourages substance use?',
  'How prepared do you feel to set firm but supportive boundaries?',
  'How frequently do you worry about long-term consequences if patterns continue?',
  "How ready are you to take decisive action to protect your child's well-being?",
];

// Per-question behavior anchors. Index 0 = the label for score 1 (strength),
// index 3 = the label for score 4 (concern). 1 always reads as the healthiest
// end, 4 always reads as the most concerning end — regardless of whether the
// question stem is naturally "more = worse" (frequency, intensity) or
// "more = better" (confidence, alignment, readiness). The labels carry the
// direction so the parent never has to translate.
export const ANSWER_LABELS: string[][] = [
  // Q1 — certainty of use
  [
    'Confident they have not',
    'Not sure, but I do not think so',
    'Strongly suspect',
    'Confirmed or seen direct evidence',
  ],
  // Q2 — suspected frequency
  ['Never', 'Once or twice, isolated', 'A few times a month', 'Weekly or more'],
  // Q3 — secrecy / lying / avoidance
  [
    'No — open and honest',
    'Occasionally evasive',
    'Often secretive or avoidant',
    'Constantly — will not engage at all',
  ],
  // Q4 — exposure to environments
  [
    'Rarely or never',
    'Occasionally',
    'Often — most weekends',
    'Most of their free time',
  ],
  // Q5 — intensity of conflict
  [
    'Calm — disagreements resolve easily',
    'Occasional tension',
    'Frequent arguments',
    'Yelling, slamming doors, near-daily',
  ],
  // Q6 — confidence to confront (inverted stem)
  [
    'Confident — I know what to say',
    'Somewhat confident',
    'Unsure how to approach it',
    'Avoid it entirely — dread the conversation',
  ],
  // Q7 — consistency of consequences
  [
    'Always consistent',
    'Mostly consistent',
    'Inconsistent',
    'Rules rarely or never enforced',
  ],
  // Q8 — over/underreacting doubt
  [
    'Almost never',
    'Occasionally',
    'Often — second-guess most of the time',
    'Constantly — paralyzed by doubt',
  ],
  // Q9 — mood swings / withdrawal / aggression
  [
    'No noticeable change',
    'Mild changes',
    'Clear and frequent changes',
    'Dramatic or near-daily changes',
  ],
  // Q10 — safety concern (driving, risky environments)
  [
    'Not concerned',
    'Mildly concerned',
    'Serious concern',
    'Active fear — lose sleep over it',
  ],
  // Q11 — caregiver / co-parent alignment (inverted stem)
  [
    'Fully aligned — same page on rules and tone',
    'Mostly aligned',
    'Disagree often',
    'Pulling in opposite directions, or no co-parent contact',
  ],
  // Q12 — negative peers
  [
    'Rarely or never',
    'Some peers I worry about',
    'Most of their friends are concerning',
    'Almost exclusively with peers I distrust',
  ],
  // Q13 — child shares emotional pain (inverted stem)
  [
    'Very comfortable — talks openly',
    'Sometimes shares',
    'Rarely shares',
    'Shuts down completely — will not engage',
  ],
  // Q14 — monitoring whereabouts (inverted stem)
  [
    'Consistently — always know',
    'Most of the time',
    'Often unsure',
    'Rarely know where they are',
  ],
  // Q15 — school / community support (inverted stem)
  [
    'Very supported — actively in touch with school / coaches',
    'Some support',
    'Limited support',
    'Feel alone — no school or community contact',
  ],
  // Q16 — has sought guidance from a professional
  [
    'Yes, currently working with one',
    'Reached out, exploring options',
    'Considered but have not yet',
    'No — would not know where to start',
  ],
  // Q17 — exhausted / fearful / overwhelmed
  [
    'Rarely or never',
    'Occasionally',
    'Often — most weeks',
    'Near-daily — running on empty',
  ],
  // Q18 — clarity of next-steps plan (inverted stem)
  [
    'Very clear — written plan aligned with co-parent',
    'Some idea, not detailed',
    'Unsure what to do next',
    'No plan at all',
  ],
  // Q19 — child accepts responsibility (inverted stem)
  [
    'Owns mistakes consistently',
    'Sometimes',
    'Rarely',
    'Never — blames others or denies',
  ],
  // Q20 — structure in daily routine (inverted stem)
  [
    'Strong routine — sleep, school, meals, activities',
    'Some structure, gaps in places',
    'Inconsistent',
    'Little or no structure',
  ],
  // Q21 — home environment discourages use (inverted stem)
  [
    'Very confident — clear rules, no access, aligned messaging',
    'Mostly confident',
    'Unsure',
    'Concerned — access, exposure, or mixed messages at home',
  ],
  // Q22 — prepared to set firm-but-supportive boundaries (inverted stem)
  [
    'Fully prepared',
    'Somewhat prepared',
    'Uncertain how to balance firm and supportive',
    'Do not know where to begin',
  ],
  // Q23 — worry about long-term consequences
  [
    'Rarely',
    'Occasionally',
    'Often',
    'Constantly — affects sleep, work, or daily mood',
  ],
  // Q24 — readiness to take decisive action (inverted stem)
  [
    'Ready now — committed to act',
    'Mostly ready',
    'Hesitant',
    'Stuck — do not know what to do',
  ],
];
