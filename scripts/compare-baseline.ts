/**
 * Compares the captured baseline against what the matrix now routes.
 *
 * Runs entirely offline: selection is deterministic, so no model call and no API
 * key are needed. That matters — this is the check that should run in CI on every
 * content edit, and one that needed a network call would not.
 *
 *   npm run baseline:compare
 *
 * ## The comparison is asymmetric, deliberately
 *
 * The old system hands the model the whole resource directory and asks it to
 * pick; the matrix decides beforehand. So the two sets differ in two quite
 * different ways, and collapsing them into one pass/fail number would hide the
 * only interesting half:
 *
 *   · **In the baseline, not routed now** — the old system cited something the
 *     routing table does not require for this submission. Usually the model's
 *     discretion, occasionally a rule the transcription missed. **These are the
 *     lines worth reading.** Each one is a question for Dave: should this have
 *     been a rule?
 *
 *   · **Routed now, not in the baseline** — the routing table required something
 *     the model failed to cite. Under the old architecture nothing checked, so
 *     this is the class of quiet omission the upgrade exists to stop. Expected,
 *     and a point in the new engine's favour rather than a regression.
 *
 * The only hard failure is a severity mismatch: the tier is arithmetic, and it
 * must agree exactly.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ContentService } from '../src/content/content.service';
import { ScoringService } from '../src/selection/scoring.service';
import { SelectionService } from '../src/selection/selection.service';
import type { Responses } from '../src/selection/selection.types';

interface Captured {
  fixture: {
    id: string;
    language: 'en' | 'es';
    expectedTier: string;
    urgentPresent: boolean;
    responses: number[];
  };
  sectionsEmpty: string[];
  fingerprint: {
    workshops: string[];
    discussionGroups: string[];
    articlesOfActionCited: string[];
    professionalHelpSequenceCount: number;
    privateSearchLineCount: number;
    standardizedClosingPresent: boolean;
  };
}

const dir = join(__dirname, '..', 'baseline');
if (!existsSync(dir)) {
  console.error(
    `no baseline at ${dir}. Capture it from the live system first:\n  API_BASE=https://<host> API_SECRET_KEY=... npm run baseline:capture\n\nIt must be captured BEFORE the old path is switched off — after that there is nothing left to compare against.`,
  );
  process.exit(1);
}

const content = new ContentService();
const selection = new SelectionService(content, new ScoringService(content));

/** The old capture stores answers positionally; the matrix reads them by id. */
function keyed(responses: number[]): Responses {
  const out: Responses = {};
  content.assessment.questions.forEach((question, index) => {
    out[question.id] = responses[index];
  });
  return out;
}

/** Tier ids map onto the old MILD/MODERATE/SERIOUS labels; `critical` is the
 *  urgent form of SERIOUS, exactly as the live system treated it. */
const asLiveTier = (tierId: string): string =>
  tierId === 'critical' ? 'SERIOUS' : tierId.toUpperCase();

const files = readdirSync(dir).filter(
  (name) => name.endsWith('.json') && name !== 'summary.json',
);

let hardFailures = 0;
const questions: string[] = [];

for (const file of files.sort()) {
  const captured = JSON.parse(
    readFileSync(join(dir, file), 'utf8'),
  ) as Captured;
  const { fixture, fingerprint } = captured;

  const result = selection.select(
    keyed(fixture.responses),
    fixture.urgentPresent ? 'urgent concern present in baseline' : undefined,
  );

  console.log(`\n${fixture.id}`);

  // --- severity: the one hard requirement
  const tier = asLiveTier(result.tierId);
  if (tier !== fixture.expectedTier) {
    console.log(
      `  ✗ SEVERITY MOVED: baseline ${fixture.expectedTier}, matrix ${tier}`,
    );
    hardFailures += 1;
  } else {
    console.log(
      `  ✓ severity ${fixture.expectedTier} (matrix: ${result.tierId})`,
    );
  }

  // --- resources
  const routedTitles = result.workshopIds.map(
    (id) => content.workshop(id).title,
  );
  const routedGroups = result.discussionGroupIds.map(
    (id) => `${content.discussionGroup(id).name} discussion group`,
  );

  const baselineOnly = [
    ...fingerprint.workshops.filter((title) => !routedTitles.includes(title)),
    ...fingerprint.discussionGroups.filter(
      (name) => !routedGroups.includes(name),
    ),
  ];
  const routedOnly = [
    ...routedTitles.filter((title) => !fingerprint.workshops.includes(title)),
    ...routedGroups.filter(
      (name) => !fingerprint.discussionGroups.includes(name),
    ),
  ];

  if (baselineOnly.length > 0) {
    console.log(
      `  ? cited by the old system, not routed by the matrix — for Dave:`,
    );
    for (const item of baselineOnly) console.log(`      · ${item}`);
    questions.push(...baselineOnly.map((item) => `${fixture.id}: ${item}`));
  }
  if (routedOnly.length > 0) {
    console.log(`  + routed by the matrix, missed by the old system:`);
    for (const item of routedOnly) console.log(`      · ${item}`);
  }
  if (baselineOnly.length === 0 && routedOnly.length === 0) {
    console.log(`  ✓ resources identical`);
  }

  // --- what the old system got wrong, recorded so the improvement is visible
  if (fingerprint.articlesOfActionCited.length > 0) {
    console.log(
      `  ! the baseline cited ${fingerprint.articlesOfActionCited.length} Article(s) of Action to the parent, which the methodology forbids — the new engine cannot`,
    );
  }
  if (captured.sectionsEmpty.length > 0) {
    console.log(
      `  ! the baseline shipped ${captured.sectionsEmpty.length} EMPTY section(s) (${captured.sectionsEmpty.join(', ')}) — the new schema rejects an empty section`,
    );
  }
  if (fingerprint.professionalHelpSequenceCount === 0) {
    console.log(
      `  ! the baseline contained the professional-help sequence 0 times — now checked and retried`,
    );
  }
}

console.log(`\n${'-'.repeat(70)}`);
console.log(`${files.length} baseline plan(s) compared.`);

if (questions.length > 0) {
  console.log(
    `\n${questions.length} resource(s) the old system cited that the matrix does not route.`,
  );
  console.log(
    'Each is a question for Dave, not a defect: either the model was exercising',
    '\ndiscretion the methodology never granted it, or the routing table has a gap.',
  );
}

if (hardFailures > 0) {
  console.error(
    `\n${hardFailures} SEVERITY MISMATCH(ES). The tier is arithmetic and must agree exactly — this is a regression, not a judgement call.`,
  );
  process.exit(1);
}

console.log('\nNo severity moved. The methodology holds.');
