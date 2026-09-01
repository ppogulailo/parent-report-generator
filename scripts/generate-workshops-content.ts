/**
 * Emits `content/workshops.json` from the approved resource lists.
 *
 * The titles and summaries come straight out of `src/report/prompts/resources.ts`,
 * which the founder review passes established — they are cited verbatim in
 * reports, so they are generated rather than retyped. Everything else here (ids,
 * domain mappings, the wording rules, the bans) is transcribed from the hard
 * rules in the system prompts and is flagged in RECOMMENDATION-MATRIX.md where a
 * judgement was required.
 *
 *   npx ts-node scripts/generate-workshops-content.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTICLES_OF_ACTION,
  AUXILIARY_WORKSHOPS,
  DISCUSSION_GROUPS,
  ESSENTIAL_WORKSHOPS,
} from '../src/report/prompts/resources';

const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-');

/**
 * Domain mappings the approved routing table states outright. Anything not
 * listed here is inferred from the workshop's topic and marked
 * `domainsInferred: true` so a reviewer can see which ones are our reading
 * rather than the methodology's.
 */
const ROUTED_DOMAINS: Record<string, string[]> = {
  'Understanding and Navigating Peer Pressure': ['communication-conflict'],
  'Intervening When Substance Use is Present: First Steps and Next Steps': [
    'immediate-safety-urgency',
  ],
  'How and When to Search a Room': ['immediate-safety-urgency'],
  'Understanding the Impact of Social Media on Substance Use and Mental Health':
    ['household-structure'],
  "Partnering with Schools for Your Child's Success": [
    'support-professional-engagement',
  ],
  'Building a Support Network': [
    'support-professional-engagement',
    'boundary-consistency',
  ],
  'Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills':
    ['communication-conflict'],
  'Behavioral Contracts – A Tool for Positive Change': ['boundary-consistency'],
  'Setting Boundaries with Respect: Discipline Without Punishment': [
    'boundary-consistency',
  ],
  'Legal Issues and Substance Use: Understanding the Consequences': [
    'immediate-safety-urgency',
  ],
  'Supporting LGBTQ+ Teens: Addressing Unique Substance Use Risks': [
    'communication-conflict',
  ],
  'Drug Testing': ['immediate-safety-urgency'],
  'Effective Communication: Building Trust and Engagement with Your Teen': [
    'communication-conflict',
  ],
  'Protecting Recovery: Preventing Relapse and Responding to Setbacks': [
    'immediate-safety-urgency',
  ],
  // No longer inferred: the founder-approved household-structure rule of
  // 2026-08-25 (matrix "healthy-home-environment") states this mapping.
  'Creating a Healthy Home Environment – The Power of Structure and Routine': [
    'household-structure',
  ],
};

/** Best-fit domains for the rest, by topic. Marked inferred. */
const INFERRED_DOMAINS: Record<string, string[]> = {
  'Monitoring and Intervention: Knowing When and How to Step In': [
    'immediate-safety-urgency',
  ],
  'Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment':
    ['support-professional-engagement'],
  'Reflection and Assessment': ['communication-conflict'],
  'Early Warning Signs – Identifying Substance Use Before It Becomes a Problem':
    ['immediate-safety-urgency'],
  'Family Dynamics and Substance Use: Strengthening Family Bonds to Prevent Abuse':
    ['communication-conflict'],
  'When Is It Time for Professional Help? Knowing When to Seek Outside Support':
    ['support-professional-engagement'],
  'The Power of Positive Reinforcement: Rewarding Healthy Behavior': [
    'boundary-consistency',
  ],
  'Building Self-Esteem: Helping Your Child Develop Healthy Self-Worth': [
    'communication-conflict',
  ],
  'Handling Setbacks – Staying Resilient in the Face of Challenges': [
    'immediate-safety-urgency',
  ],
  'Long-Term Strategies for Prevention: Staying Involved Through Adolescence and Beyond':
    ['household-structure'],
};

/**
 * The Circle URLs, supplied by ASAP (Emmanuel via Matt) on 2026-08-28 and
 * verified live (HTTP 200) before installation. Keyed by resource id so a
 * retitled workshop cannot silently unlink.
 *
 * Deliberately absent, because ASAP's list did not include them:
 *   · aux-protecting-recovery-preventing-relapse-and-responding (workshop)
 *   · dg-protecting-recovery (discussion group)
 * Both are cited only inside the standardized closing — plain text, never a
 * link slot — so nothing a parent sees is missing a link. Requested from Matt.
 *
 * The list also carried URLs with no counterpart in this product's approved
 * library, installed nowhere on purpose: the two menu overviews (Matt asked
 * for direct resource links, not menus), "Fostering Emotional Intelligence"
 * (not one of the 25 approved M&I resources), "Creating Your Personal
 * Prevention Program" workshop + group (excluded from this product's output by
 * founder direction — see bannedTitles), and the Effective Communication and
 * Building a Support Network discussion groups (this methodology routes to
 * workshops there, never groups — also in bannedTitles).
 */
const CIRCLE = 'https://asap-community.circle.so/c';
const CIRCLE_URLS: Record<string, string> = {
  // Essential Workshops
  'ess-monitoring-and-intervention-knowing-when-and': `${CIRCLE}/monitoring-and-intervention`,
  'ess-sustaining-recovery-parental-oversight-and-support': `${CIRCLE}/sustaining-recovery-77785e`,
  'ess-effective-communication-building-trust-and-engagement': `${CIRCLE}/effective-communication-building-trust-and-engagement-with-your-teen-2edd9b`,
  'ess-building-a-support-network': `${CIRCLE}/building-a-support-network-engaging-resources-and-allies-dddc58`,
  // Auxiliary Workshops
  'aux-reflection-and-assessment': `${CIRCLE}/reflection-and-assessment`,
  'aux-intervening-when-substance-use-is-present': `${CIRCLE}/intervening-when-substance-use-is-present-first-steps-and-next-steps`,
  'aux-early-warning-signs-identifying-substance-use': `${CIRCLE}/early-warning-signs-identifying-substance-use-before-it-becomes-a-problem`,
  'aux-family-dynamics-and-substance-use-strengthening': `${CIRCLE}/family-dynamics-and-substance-use-strengthening-family-bonds-to-prevent-abuse`,
  'aux-how-and-when-to-search-a': `${CIRCLE}/how-and-when-to-search-a-room`,
  'aux-when-is-it-time-for-professional': `${CIRCLE}/when-is-it-time-for-professional-help-knowing-when-to-seek-outside-support`,
  'aux-drug-testing': `${CIRCLE}/drug-testing`,
  'aux-behavioral-contracts-a-tool-for-positive': `${CIRCLE}/behavioral-contracts-a-tool-for-positive-change`,
  'aux-partnering-with-schools-for-your-childs': `${CIRCLE}/partnering-with-schools-for-your-child-s-success`,
  'aux-understanding-and-navigating-peer-pressure': `${CIRCLE}/understanding-and-navigating-peer-pressure`,
  'aux-setting-boundaries-with-respect-discipline-without': `${CIRCLE}/setting-boundaries-with-respect-discipline-without-punishment`,
  'aux-the-power-of-positive-reinforcement-rewarding': `${CIRCLE}/the-power-of-positive-reinforcement-rewarding-healthy-behavior`,
  'aux-building-self-esteem-helping-your-child': `${CIRCLE}/building-self-esteem-helping-your-child-develop-healthy-self-worth`,
  'aux-creating-a-healthy-home-environment-the': `${CIRCLE}/creating-a-healthy-home-environment-the-power-of-structure-and-routine`,
  'aux-supporting-lgbtq-teens-addressing-unique-substance': `${CIRCLE}/supporting-lgbtq-teens-addressing-unique-substance-use-risks`,
  'aux-understanding-the-impact-of-social-media': `${CIRCLE}/understanding-the-impact-of-social-media-on-substance-use-and-mental-health`,
  'aux-handling-setbacks-staying-resilient-in-the': `${CIRCLE}/handling-setbacks-staying-resilient-in-the-face-of-challenges`,
  'aux-managing-stress-and-pressure-helping-your': `${CIRCLE}/managing-stress-and-pressure-helping-your-teen-develop-healthy-coping-skills`,
  'aux-long-term-strategies-for-prevention-staying': `${CIRCLE}/long-term-strategies-for-prevention-staying-involved-through-adolescence-and-beyond`,
  'aux-legal-issues-and-substance-use-understanding': `${CIRCLE}/legal-issues-and-substance-use-understanding-the-consequences`,
  // Discussion Groups
  'dg-monitoring-intervention': `${CIRCLE}/monitoring-and-intervention-3da3a5`,
  'dg-sustaining-recovery': `${CIRCLE}/sustaining-recovery`,
};

const PROFESSIONAL_HELP_SENTENCES = [
  'For guidance, consider posting questions in the Sustaining Recovery discussion group.',
  'In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.',
];

const CLOSING_EN = [
  'Recovery is a journey—not a single event—and protecting the progress your child has already made is one of the most important responsibilities you have as a parent. While many adolescents go on to achieve lasting recovery, setbacks can occur. A setback does not erase the progress that has been made, and it does not have to become a return to the past.',
  'Preparation is one of your greatest strengths. We encourage you to complete the Auxiliary Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks." It will help you recognize early warning signs, respond calmly and effectively if challenges arise, and strengthen your family\'s plan to protect your child\'s recovery. We also encourage you to participate in the Protecting Recovery Discussion Group, where parents share experiences, encouragement, and practical insights while supporting one another through the ongoing journey of recovery.',
  'Remember, the purpose of monitoring, supervision, conversations, and appropriate boundaries is not simply to discover what happened or when it happened—but to understand why. Identifying and addressing the underlying reasons for substance use gives your child the greatest opportunity for long-term recovery and a healthy, meaningful future.',
];

const CLOSING_ES = [
  'La recuperación es un camino, no un solo acontecimiento, y proteger el progreso que tu hijo ya ha logrado es una de las responsabilidades más importantes que tienes como padre. Aunque muchos adolescentes llegan a alcanzar una recuperación duradera, pueden ocurrir contratiempos. Un contratiempo no borra el progreso alcanzado ni tiene por qué convertirse en un regreso al pasado.',
  'La preparación es una de tus mayores fortalezas. Te animamos a completar el Auxiliary Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks". Te ayudará a reconocer las señales de alerta tempranas, a responder con calma y eficacia si surgen dificultades, y a fortalecer el plan de tu familia para proteger la recuperación de tu hijo. También te animamos a participar en el Protecting Recovery Discussion Group, donde los padres comparten experiencias, aliento y conocimientos prácticos mientras se apoyan mutuamente a lo largo del camino continuo de la recuperación.',
  'Recuerda que el propósito del monitoreo, la supervisión, las conversaciones y los límites apropiados no es simplemente descubrir qué pasó o cuándo pasó, sino entender por qué. Identificar y abordar las razones de fondo del consumo de sustancias le da a tu hijo la mayor oportunidad de lograr una recuperación a largo plazo y un futuro sano y significativo.',
];

const DISCUSSION_GROUP_USAGE: Record<string, { usage: string; id: string }> = {
  'Monitoring and Intervention': {
    id: 'dg-monitoring-intervention',
    usage:
      'The parent\'s primary peer-support group. Cited at every severity, in the parent\'s own support priority. Action language only — "join the" or "reach out to", never passive.',
  },
  'Sustaining Recovery': {
    id: 'dg-sustaining-recovery',
    usage:
      'Professional-help adjunct only. Appears exclusively inside the professional-help sequence, and never in a paragraph that does not reference professional help.',
  },
  'Protecting Recovery': {
    id: 'dg-protecting-recovery',
    usage:
      'Recovery-maintenance peer group. Cited only inside the standardized closing, on MODERATE, SERIOUS and CRITICAL plans. Never in MILD.',
  },
};

const domainsFor = (
  title: string,
): { applicableDomains: string[]; domainsInferred: boolean } => {
  const routed = ROUTED_DOMAINS[title];
  if (routed) return { applicableDomains: routed, domainsInferred: false };
  const inferred = INFERRED_DOMAINS[title];
  if (inferred) return { applicableDomains: inferred, domainsInferred: true };
  throw new Error(
    `no domain mapping for "${title}" — add it to ROUTED_DOMAINS or INFERRED_DOMAINS`,
  );
};

function build() {
  const workshops = [
    ...ESSENTIAL_WORKSHOPS.map((w) => ({
      id: `ess-${slug(w.title)}`,
      category: 'essential' as const,
      title: w.title,
      summary: w.summary,
      url: CIRCLE_URLS[`ess-${slug(w.title)}`] ?? null,
      ...domainsFor(w.title),
    })),
    ...AUXILIARY_WORKSHOPS.map((w) => ({
      id: `aux-${slug(w.title)}`,
      category: 'auxiliary' as const,
      title: w.title,
      summary: w.summary,
      url: CIRCLE_URLS[`aux-${slug(w.title)}`] ?? null,
      ...domainsFor(w.title),
    })),
  ];

  // A URL keyed to an id that no longer exists is a link a family quietly does
  // not receive. Fail the generator rather than emit it.
  const knownIds = new Set([
    ...workshops.map((w) => w.id),
    ...DISCUSSION_GROUPS.map((name) => DISCUSSION_GROUP_USAGE[name].id),
  ]);
  const orphanUrls = Object.keys(CIRCLE_URLS).filter(
    (id) => !knownIds.has(id),
  );
  if (orphanUrls.length > 0) {
    throw new Error(
      `CIRCLE_URLS keys match no resource: ${orphanUrls.join(', ')}`,
    );
  }
  const unlinked = [...knownIds].filter((id) => !CIRCLE_URLS[id]);
  console.log(
    unlinked.length > 0
      ? `still unlinked (no URL supplied): ${unlinked.join(', ')}`
      : 'every resource has a URL',
  );

  return {
    _comment: [
      'GENERATED by scripts/generate-workshops-content.ts. Titles and summaries',
      'come from the approved resource lists and are cited verbatim in reports —',
      'never translated, never abbreviated, in Spanish reports too.',
      '',
      'URLS INSTALLED 2026-08-28 from the Circle list supplied by ASAP (Emmanuel',
      'via Matt), every one verified live before installation. Two remain null,',
      'because the list did not include them: the Protecting Recovery workshop',
      'and the Protecting Recovery discussion group. Both are cited only inside',
      'the standardized closing (plain text, never a link slot), so no parent-',
      'visible link is missing. Requested from Matt.',
      '',
      'TWO COUNTS IN THE PROMPTS ARE STALE, and the lists here are authoritative:',
      '  · The English prompt says "5 Essential" in one place. There are 4 — the',
      '    prevention-planning workshop was removed by founder direction and its',
      '    two titles are in bannedTitles below.',
      '  · Both prompts say "20 Auxiliary". There are 21 — "Protecting Recovery"',
      '    was added in the Beta Finalization milestone and the count was not',
      '    updated. This is the kind of drift that stops being possible once the',
      '    library is data instead of prose.',
      '',
      'DOMAIN MAPPINGS marked domainsInferred:true are our reading of the topic,',
      "not the methodology's statement. They are listed for confirmation in",
      'RECOMMENDATION-MATRIX.md §5.',
    ],
    version: '1.0.0',
    status: 'approved',
    categoryLabels: {
      essential: { en: 'Essential Workshop', es: 'Essential Workshop' },
      auxiliary: { en: 'Auxiliary Workshop', es: 'Auxiliary Workshop' },
    },
    workshops,
    /**
     * Empty on purpose. Sustaining Recovery leads its workshop list with
     * `aux-protecting-recovery`; the Monitoring & Intervention methodology
     * states no such preference, and inventing one would be us deciding what a
     * family sees first.
     */
    featuredWorkshopIds: [],
    discussionGroups: DISCUSSION_GROUPS.map((name) => ({
      id: DISCUSSION_GROUP_USAGE[name].id,
      name,
      usage: DISCUSSION_GROUP_USAGE[name].usage,
      url: CIRCLE_URLS[DISCUSSION_GROUP_USAGE[name].id] ?? null,
    })),
    requiredWording: [
      {
        id: 'professional-help-sequence',
        description:
          'Every mention of professional help must carry the founder-approved two-sentence route to ASAP-endorsed providers. This is the rule that was being honoured intermittently in Sustaining Recovery — present in one report, absent from six paragraphs of another two days later — because it lived only in the prompt and nothing checked it.',
        scope: 'at-least-once',
        triggers: {
          en: [
            'therapist',
            'treatment provider',
            'treatment center',
            'professional help',
            'ASAP-endorsed',
            'clinician',
            'treatment program',
          ],
          es: [
            'terapeuta',
            'proveedor de tratamiento',
            'centro de tratamiento',
            'ayuda profesional',
            'ASAP-endorsed',
            'clínico',
            'programa de tratamiento',
          ],
        },
        // Identical in both languages by founder direction: the Spanish report
        // carries these two sentences in English, because they name a resource
        // and a Circle location rather than describing anything.
        sentences: {
          en: PROFESSIONAL_HELP_SENTENCES,
          es: PROFESSIONAL_HELP_SENTENCES,
        },
        strictness: 'retry',
      },
      {
        id: 'private-search-line',
        description:
          'Wherever the plan describes searching a room, backpack or phone, the canonical two sentences must appear. "Privately" and "without your child present" are written, never implied — a search the child witnesses is a different and worse intervention than the one the methodology prescribes.',
        scope: 'at-least-once',
        triggers: {
          en: ['search', 'searching', 'backpack'],
          es: ['revisión', 'revisar', 'mochila'],
        },
        sentences: {
          en: [
            "Conduct any search of your child's room, backpack, or phone privately and without your child present.",
            'Leave the room as you found it and document anything relevant.',
          ],
          es: [
            'Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente.',
            'Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante.',
          ],
        },
        strictness: 'retry',
      },
      {
        id: 'standardized-closing',
        description:
          'The standardized closing — Protecting Recovery. Excluded from MILD by the methodology. In Version 1.0 this ships as a static section rendered by the platform, so it is exact rather than "essentially verbatim"; this rule remains as a backstop that fails loudly if the section is ever converted back to model-written prose.',
        scope: 'at-least-once',
        triggers: {
          en: ['Recovery is a journey'],
          es: ['La recuperación es un camino'],
        },
        sentences: { en: CLOSING_EN, es: CLOSING_ES },
        appliesAtTiers: ['moderate', 'serious', 'critical'],
        strictness: 'warn',
      },
    ],
    bannedTitles: {
      workshops: [
        // Hallucinated title — never an actual workshop.
        'Creating Your Personalized Prevention Plan',
        // A real workshop, excluded from this plan's output by founder direction.
        'Creating Your Personal Prevention Program',
        // Invented titles the model has reached for before.
        'Talking To Your Teen',
        'Family Recovery',
        'Substance Awareness',
      ],
      discussionGroups: [
        'Effective Communication discussion group',
        'Parent Support Forum discussion group',
        'Building a Support Network discussion group',
        'Creating Your Personal Prevention Program discussion group',
      ],
      // Foundational text taught inside the workshops. Never cited to a parent
      // as a reading recommendation — the action is to attend the workshop.
      articlesOfAction: [...ARTICLES_OF_ACTION],
    },
  };
}

const target = join(__dirname, '..', 'content', 'workshops.json');
writeFileSync(target, `${JSON.stringify(build(), null, 2)}\n`, 'utf8');
console.log(`wrote ${target}`);
