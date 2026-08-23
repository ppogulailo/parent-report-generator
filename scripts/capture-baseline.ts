/**
 * Captures a behavioural baseline of the CURRENT system, before the engine
 * swap.
 *
 * This is the second half of what Milestone 1 promises: the matrix says what the
 * methodology is, and this says what the live system actually does with it. When
 * the new engine is in place, `compare-baseline.ts` reads these files back and
 * shows that the routing did not move.
 *
 * Eight plans — four severity levels across both languages — because the urgent
 * concern path is a fourth report shape with two extra sections and its own
 * rules, and it is the report where a regression matters most.
 *
 * What is compared later is the ROUTING FINGERPRINT, not the prose. Two runs of
 * a language model never produce identical sentences, so comparing text would
 * fail every time and prove nothing. What must not change is which resources a
 * family is pointed at, and which severity register the plan is written in.
 *
 *   API_BASE=http://localhost:3000 API_SECRET_KEY=... npm run baseline:capture
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTICLES_OF_ACTION,
  AUXILIARY_WORKSHOPS,
  DISCUSSION_GROUPS,
  ESSENTIAL_WORKSHOPS,
} from '../src/report/prompts/resources';
import { computeSeverityTier } from '../src/report/prompts/user.prompt';
import { DOMAIN_MAP } from '../src/report/scoring/domain.map';

type Language = 'en' | 'es';

/**
 * Sections the old response includes as an empty string when they do not apply.
 * Both are urgent-only, so a blank one on a non-urgent plan is correct, not a
 * defect — and must not be reported as one.
 */
const CONDITIONAL_SECTIONS = ['urgentConcern', 'consideringInpatient'];

interface Fixture {
  id: string;
  language: Language;
  expectedTier: 'MILD' | 'MODERATE' | 'SERIOUS';
  urgent?: string;
  responses: number[];
}

/** Response vectors chosen to land in each tier, then asserted below rather
 *  than trusted — a fixture that has drifted into the wrong tier would make the
 *  whole baseline meaningless while still looking fine. */
const VECTORS: Array<{
  id: string;
  expectedTier: 'MILD' | 'MODERATE' | 'SERIOUS';
  urgent?: string;
  responses: number[];
}> = [
  {
    id: 'mild',
    expectedTier: 'MILD',
    responses: Array<number>(24).fill(1),
  },
  {
    id: 'moderate',
    expectedTier: 'MODERATE',
    // Real signals across conflict, boundaries and parent strain, with no use
    // or safety signal — the case the third SERIOUS pathway deliberately leaves
    // in MODERATE.
    responses: [
      1, 1, 3, 2, 3, 3, 3, 3, 2, 1, 3, 2, 2, 2, 2, 2, 3, 3, 2, 2, 2, 3, 2, 2,
    ],
  },
  {
    id: 'serious',
    expectedTier: 'SERIOUS',
    responses: Array<number>(24).fill(4),
  },
  {
    id: 'critical',
    expectedTier: 'SERIOUS',
    urgent:
      'I found an unknown substance in his backpack last night and he will not tell me what it is.',
    responses: [
      4, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 2, 3, 2, 3, 4, 3, 3, 2, 2, 3, 4, 3,
    ],
  },
];

const FIXTURES: Fixture[] = VECTORS.flatMap((v) =>
  (['en', 'es'] as Language[]).map((language) => ({
    ...v,
    id: `${v.id}-${language}`,
    language,
  })),
);

function liveDomainScores(responses: number[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [label, indices] of Object.entries(DOMAIN_MAP)) {
    const values = indices.map((i) => Math.min(4, Math.max(1, responses[i])));
    scores[label] =
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
      100;
  }
  return scores;
}

/** Every resource title the system may legitimately cite, longest first so that
 *  a title containing another title is matched as itself. */
const RESOURCE_TITLES = [
  ...ESSENTIAL_WORKSHOPS.map((w) => ({
    kind: 'essential-workshop' as const,
    title: w.title,
  })),
  ...AUXILIARY_WORKSHOPS.map((w) => ({
    kind: 'auxiliary-workshop' as const,
    title: w.title,
  })),
  ...DISCUSSION_GROUPS.map((name) => ({
    kind: 'discussion-group' as const,
    title: `${name} discussion group`,
  })),
  ...ARTICLES_OF_ACTION.map((title) => ({
    kind: 'article-of-action' as const,
    title,
  })),
].sort((a, b) => b.title.length - a.title.length);

/**
 * The comparable part of a report: which resources it cited, and which severity
 * register it was written in.
 *
 * Articles of Action are included even though citing one to a parent is banned —
 * if the live system is quietly breaking that rule, the baseline should record
 * it rather than hide it, because "the new engine cites fewer articles" is a
 * fix and not a regression.
 */
function fingerprint(text: string) {
  const cited = RESOURCE_TITLES.filter((r) => text.includes(r.title));
  return {
    workshops: cited
      .filter((c) => c.kind.endsWith('workshop'))
      .map((c) => c.title)
      .sort(),
    discussionGroups: cited
      .filter((c) => c.kind === 'discussion-group')
      .map((c) => c.title)
      .sort(),
    articlesOfActionCited: cited
      .filter((c) => c.kind === 'article-of-action')
      .map((c) => c.title)
      .sort(),
    professionalHelpSequenceCount: countOccurrences(
      text,
      'In Admin Spaces, under Treatment Providers',
    ),
    privateSearchLineCount: countOccurrences(text, [
      'privately and without your child present',
      'en privado y sin que tu hijo esté presente',
    ]),
    standardizedClosingPresent:
      text.includes('Recovery is a journey') ||
      text.includes('La recuperación es un camino'),
  };
}

function countOccurrences(text: string, needle: string | string[]): number {
  const needles = Array.isArray(needle) ? needle : [needle];
  return needles.reduce(
    (total, n) => total + (n ? text.split(n).length - 1 : 0),
    0,
  );
}

async function main() {
  const base = process.env.API_BASE ?? 'http://localhost:3000';
  const key = process.env.API_SECRET_KEY;
  if (!key) {
    console.error(
      'API_SECRET_KEY is required — the generate endpoint is guarded.',
    );
    process.exit(1);
  }

  // Assert the fixtures still land where they are supposed to before spending
  // any model calls on them.
  for (const fixture of FIXTURES) {
    const actual = computeSeverityTier(
      fixture.responses,
      liveDomainScores(fixture.responses),
      fixture.urgent,
    );
    if (actual !== fixture.expectedTier) {
      console.error(
        `fixture "${fixture.id}" expects ${fixture.expectedTier} but the live logic says ${actual} — fix the vector before capturing`,
      );
      process.exit(1);
    }
  }

  const dir = join(__dirname, '..', 'baseline');
  mkdirSync(dir, { recursive: true });

  const summary: Record<string, unknown> = {};

  for (const fixture of FIXTURES) {
    process.stdout.write(`capturing ${fixture.id}… `);
    const response = await fetch(`${base}/api/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        responses: fixture.responses,
        language: fixture.language,
        ...(fixture.urgent ? { crisis: fixture.urgent } : {}),
      }),
    });

    if (!response.ok) {
      console.error(
        `\nfailed: ${response.status} ${await response.text().catch(() => '')}`,
      );
      process.exit(1);
    }

    const body = (await response.json()) as {
      domainScores: Record<string, number>;
      topDomains: string[];
      report: Record<string, string>;
    };

    const prose = Object.values(body.report).join('\n\n');
    const captured = {
      fixture: {
        id: fixture.id,
        language: fixture.language,
        expectedTier: fixture.expectedTier,
        urgentPresent: Boolean(fixture.urgent),
        responses: fixture.responses,
      },
      domainScores: body.domainScores,
      topDomains: body.topDomains,
      sectionsPresent: Object.entries(body.report)
        .filter(([, value]) => value.trim().length > 0)
        .map(([key]) => key)
        .sort(),
      // The old response always carries every key, using an empty string for a
      // section that does not apply. So "empty" alone means nothing — the two
      // urgent-only sections are legitimately blank on a non-urgent plan, and
      // reporting those as holes would libel the current system.
      sectionsConditionallyAbsent: Object.entries(body.report)
        .filter(
          ([key, value]) =>
            value.trim().length === 0 && CONDITIONAL_SECTIONS.includes(key),
        )
        .map(([key]) => key)
        .sort(),
      sectionsEmpty: Object.entries(body.report)
        .filter(
          ([key, value]) =>
            value.trim().length === 0 && !CONDITIONAL_SECTIONS.includes(key),
        )
        .map(([key]) => key)
        .sort(),
      fingerprint: fingerprint(prose),
      report: body.report,
    };

    writeFileSync(
      join(dir, `${fixture.id}.json`),
      `${JSON.stringify(captured, null, 2)}\n`,
      'utf8',
    );
    summary[fixture.id] = {
      ...captured.fingerprint,
      sectionsEmpty: captured.sectionsEmpty,
    };
    console.log(
      `${captured.fingerprint.workshops.length} workshops, ${captured.fingerprint.discussionGroups.length} groups` +
        (captured.sectionsEmpty.length > 0
          ? `, ${captured.sectionsEmpty.length} EMPTY section(s): ${captured.sectionsEmpty.join(', ')}`
          : ''),
    );
  }

  writeFileSync(
    join(dir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  console.log(`\nwrote ${FIXTURES.length + 1} files to ${dir}`);
  console.log(
    'Commit these. They are the evidence that the methodology did not move.',
  );
}

void main();
