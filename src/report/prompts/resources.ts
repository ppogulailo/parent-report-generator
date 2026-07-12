// Authoritative ASAP resource lists provided by the program founder.
// Reference these verbatim — do not invent, paraphrase, or number them.
// Articles of Action are referred to by TITLE only (no chapter numbers).

export const ARTICLES_OF_ACTION: string[] = [
  'Self-Reflection and Assessment: Understanding the Impact of Drug Abuse on Families and Collateral Damage',
  'Know the Facts: Understanding the Drug Crisis',
  'A Good Plan Sets a Good Foundation / Creating Partnerships: Building a Support System for Your Child',
  'Finding the Right Therapist: How, When and Why',
  'Partnering with Schools',
  'Drug Testing: A Crucial Step in Intervention',
  'Behavior Contracts: A Tool for Accountability and Growth',
  'Monitoring Social Media – Balancing Supervision and Trust',
  'GPS and Phone Tracking – Weighing the Pros and Cons',
  'Searching Your Child’s Room – Knowing What’s in Your House',
  'Conversational Surgery – Empathy with Firmness: Positive Discipline in Parenting',
  'Peer Pressure and Social Contagion: Guiding Your Child Through Influence',
  'Mental Health and Drug Use – The Link Between Mental Health and Substance Abuse',
  'Navigating the Legal System – What Parents Need to Know',
  'Inpatient Residential & Intensive Outpatient Programs – When Treatment Becomes Necessary',
  'The School Resource Officer (SRO)',
];

// Founder review pass #9 (2026-05-27): "Creating Your Personalized Prevention
// Plan" was a hallucinated title (never an actual workshop). The real workshop
// is "Creating Your Personal Prevention Program" — but per founder direction
// it is NOT recommended or referenced inside Parent Action Plan output for
// separate methodological reasons. Both titles are banned from the output via
// the BANNED PREVENTION WORKSHOP TITLES hard rule in system.prompt.ts; the
// Essential Workshops list drops from 5 → 4.
export const ESSENTIAL_WORKSHOPS: Array<{ title: string; summary: string }> = [
  {
    title:
      'Effective Communication: Building Trust and Engagement with Your Teen',
    summary:
      'Core conversational skills for engaging your teen without escalation — listening, framing, and timing that keeps the dialogue open.',
  },
  {
    title: 'Monitoring and Intervention: Knowing When and How to Step In',
    summary:
      'Recognizing patterns of use, when to step in, and how to lead a structured intervention conversation grounded in the ASAP method.',
  },
  {
    title: 'Building a Support Network',
    summary:
      'Helping parents build a broad support network for their child — family members, school staff, coaches, therapists, and community resources. Engaging schools is one of the most important components.',
  },
  {
    title:
      'Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment',
    summary:
      'Holding the recovery line after professional treatment — oversight, ongoing structure, and the parent’s role in sustaining the work long-term.',
  },
];

export const AUXILIARY_WORKSHOPS: Array<{ title: string; summary: string }> = [
  {
    title: 'Reflection and Assessment',
    summary:
      'Helping parents step back and evaluate their child’s behavior patterns and overall situation clearly.',
  },
  {
    title:
      'Intervening When Substance Use is Present: First Steps and Next Steps',
    summary:
      'A structured approach to taking immediate action when substance use is confirmed or strongly suspected.',
  },
  {
    title:
      'Early Warning Signs – Identifying Substance Use Before It Becomes a Problem',
    summary:
      'Recognizing subtle behavioral, emotional, and social changes that may indicate early substance use.',
  },
  {
    title:
      'Family Dynamics and Substance Use: Strengthening Family Bonds to Prevent Abuse',
    summary:
      'Improving family communication and relationships to reduce risk and support recovery.',
  },
  {
    title: 'How and When to Search a Room',
    summary:
      'Guidance on conducting a room search appropriately while minimizing conflict and preserving trust.',
  },
  {
    title:
      'When Is It Time for Professional Help? Knowing When to Seek Outside Support',
    summary: 'Identifying when outside intervention is necessary.',
  },
  {
    title: 'Drug Testing',
    summary:
      'Understanding when and how to use drug testing as a monitoring and accountability tool.',
  },
  {
    title: 'Behavioral Contracts – A Tool for Positive Change',
    summary:
      'Creating clear agreements with expectations, rewards, and consequences.',
  },
  {
    title: "Partnering with Schools for Your Child's Success",
    summary:
      'Working with school staff to support accountability and outcomes.',
  },
  {
    title: 'Understanding and Navigating Peer Pressure',
    summary: 'Helping teens resist negative influences.',
  },
  {
    title: 'Setting Boundaries with Respect: Discipline Without Punishment',
    summary: 'Enforcing rules while maintaining a supportive relationship.',
  },
  {
    title: 'The Power of Positive Reinforcement: Rewarding Healthy Behavior',
    summary: 'Encouraging positive choices through recognition.',
  },
  {
    title:
      'Building Self-Esteem: Helping Your Child Develop Healthy Self-Worth',
    summary: 'Supporting confidence and identity development.',
  },
  {
    title:
      'Creating a Healthy Home Environment – The Power of Structure and Routine',
    summary: 'Establishing consistency and stability.',
  },
  {
    title: 'Supporting LGBTQ+ Teens: Addressing Unique Substance Use Risks',
    summary: 'Understanding identity-related challenges.',
  },
  {
    title:
      'Understanding the Impact of Social Media on Substance Use and Mental Health',
    summary: 'Recognizing online influences.',
  },
  {
    title: 'Handling Setbacks – Staying Resilient in the Face of Challenges',
    summary: 'Responding constructively to relapses.',
  },
  {
    title:
      'Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills',
    summary: 'Teaching alternatives to substance use.',
  },
  {
    title:
      'Long-Term Strategies for Prevention: Staying Involved Through Adolescence and Beyond',
    summary: 'Maintaining engagement over time.',
  },
  {
    title: 'Legal Issues and Substance Use: Understanding the Consequences',
    summary: 'Awareness of legal risks and responses.',
  },
  // Beta Finalization milestone (item 1, founder-approved) — added for the
  // standardized "Protecting Recovery" closing on MODERATE/SERIOUS/CRITICAL plans.
  // Cited ONLY inside the STANDARDIZED CLOSING hard rule.
  {
    title: 'Protecting Recovery: Preventing Relapse and Responding to Setbacks',
    summary:
      'Recognizing early relapse warning signs and responding to setbacks.',
  },
];

// Founder-approved discussion groups. Pass #7 locked this to two; the Beta
// Finalization milestone (item 1) adds a third, founder-approved entry.
// - "Monitoring and Intervention" — parent's primary peer-support group, every tier,
//   used for BUILD YOUR PERSONAL SUPPORT GROUP in TOP 3 IMMEDIATE PRIORITIES.
// - "Sustaining Recovery" — professional-help adjunct, only inside the PROFESSIONAL
//   HELP SEQUENCE alongside an approved professional-help recommendation.
// - "Protecting Recovery" — recovery-maintenance peer group (Beta Finalization,
//   founder-approved). Cited ONLY inside the STANDARDIZED CLOSING hard rule on
//   MODERATE/SERIOUS/CRITICAL plans.
// Discussion groups previously listed (Effective Communication, Parent Support Forum,
// Building a Support Network, Creating Your Personal Prevention Program) are NOT
// approved for parent-facing recommendations and must never appear in the output.
export const DISCUSSION_GROUPS: string[] = [
  'Monitoring and Intervention',
  'Sustaining Recovery',
  'Protecting Recovery',
];

export function formatResourceDirectory(): string {
  const essential = ESSENTIAL_WORKSHOPS.map(
    (w) => `- ${w.title} — ${w.summary}`,
  ).join('\n');
  const workshops = AUXILIARY_WORKSHOPS.map(
    (w) => `- ${w.title} — ${w.summary}`,
  ).join('\n');
  const groups = DISCUSSION_GROUPS.map((g) => `- ${g}`).join('\n');

  return `ASAP RESOURCE DIRECTORY — these are the ONLY parent-facing resources you may cite in the plan. Use these exact titles verbatim. Do not invent, rename, paraphrase, shorten, combine, or number them. If no directory title fits, omit the citation — never invent a workshop or group name that sounds like it should exist.

ARTICLES OF ACTION — DO NOT cite by title in the plan. Articles of Action are taught inside the workshops; the parent's reading recommendations come through the workshop curriculum, not through this plan. Banned in any form: "the Article of Action titled X", "Articles of Action: X", "read the Article of Action 'X'", "see Article of Action X". The plan recommends workshops and approved discussion groups — Articles by title are out of scope.

ASAP Discussion Groups (${DISCUSSION_GROUPS.length} approved — the ONLY discussion groups that may appear in the plan; tell the parent to join and actively post, not just be aware):
${groups}

Approved discussion group usage:
- "Monitoring and Intervention discussion group" — the parent's own peer-support group. Use for BUILD YOUR PERSONAL SUPPORT GROUP in TOP 3 IMMEDIATE PRIORITIES in every tier (MILD, MODERATE, SERIOUS), and for parent isolation / exhaustion / weak co-parent alignment / active intervention work.
- "Sustaining Recovery discussion group" — the professional-help adjunct. Use ONLY inside the PROFESSIONAL HELP SEQUENCE, in a paragraph that also references professional help, with the approved verbatim wording.
- "Protecting Recovery Discussion Group" — the recovery-maintenance peer group. Use ONLY inside the STANDARDIZED CLOSING (the "Protecting Recovery" closing on MODERATE / SERIOUS / CRITICAL plans). Do NOT cite it anywhere else, and do NOT use it in MILD.

BANNED discussion group names — never appear in the output under any circumstances: "Effective Communication discussion group", "Parent Support Forum discussion group", "Building a Support Network discussion group", "Creating Your Personal Prevention Program discussion group", or any other unapproved or invented group name. For communication, prevention, or child-network topics, cite a workshop — not a discussion group.

Essential Workshops (4 total — core ASAP curriculum; cite by exact title as 'Essential Workshop "X"'):
${essential}

BANNED PREVENTION WORKSHOP TITLES — never appear in the plan in any form, regardless of severity. Both names are off-limits as a recommendation, citation, or passing reference:
- "Creating Your Personalized Prevention Plan" (hallucinated title — not a real workshop)
- "Creating Your Personal Prevention Program" (real workshop, but excluded from Parent Action Plan output per founder direction)
If you would have routed to either of these for prevention planning, route to the Essential Workshop "Building a Support Network" (for the family-side network and school engagement) and/or the Essential Workshop "Effective Communication: Building Trust and Engagement with Your Teen" (for parent-child dialogue) instead.

Auxiliary Workshops (${AUXILIARY_WORKSHOPS.length} total — topic-matched; pick by topic match, name the exact title as 'Auxiliary Workshop "X"'):
${workshops}`;
}
