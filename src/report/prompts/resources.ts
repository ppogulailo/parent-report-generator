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
    title: 'Partnering with Schools for Your Child\'s Success',
    summary:
      'Working with school staff to support accountability and outcomes.',
  },
  {
    title: 'Understanding and Navigating Peer Pressure',
    summary: 'Helping teens resist negative influences.',
  },
  {
    title: 'Setting Boundaries with Respect: Discipline Without Punishment',
    summary:
      'Enforcing rules while maintaining a supportive relationship.',
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
];

export const DISCUSSION_GROUPS: string[] = [
  'Monitoring and Intervention',
  'Sustaining Recovery',
  'Effective Communication',
  'Building a Support Network',
  'Parent Support Forum',
  'Creating Your Personal Prevention Program',
];

export function formatResourceDirectory(): string {
  const articles = ARTICLES_OF_ACTION.map((t) => `- ${t}`).join('\n');
  const workshops = AUXILIARY_WORKSHOPS.map(
    (w) => `- ${w.title} — ${w.summary}`,
  ).join('\n');
  const groups = DISCUSSION_GROUPS.map((g) => `- ${g}`).join('\n');

  return `ASAP RESOURCE DIRECTORY — use these exact titles verbatim. Do not invent, rename, paraphrase, shorten, or number them. Do not cite chapters.

Articles of Action (16 total — reference by title only):
${articles}

ASAP Discussion Groups (6 total — primary support mechanism; tell the parent to join and actively post, not just be aware):
${groups}

Auxiliary Workshops (20 total — pick by topic match, name the exact title):
${workshops}`;
}
