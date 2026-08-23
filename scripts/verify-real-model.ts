/**
 * Generates a plan for every severity in both languages against the REAL model
 * and checks each one against the rules the methodology states.
 *
 * The mock proves the contract; this proves the model can satisfy it. They are
 * different claims and the second one cannot be made without spending money, so
 * it is a script rather than a test — run deliberately, before a launch or after
 * a prompt change.
 *
 *   API_BASE=http://localhost:3500 API_SECRET_KEY=... npx ts-node scripts/verify-real-model.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContentService } from '../src/content/content.service';

type Language = 'en' | 'es';

interface Section {
  key: string;
  type: string;
  title: string;
  body?: string;
  items?: string[];
  recommendations?: { headline: string; body: string }[];
  workshops?: { title: string; whyThisFamily: string }[];
}

const content = new ContentService();

const CASES: { id: string; base: number; urgent?: string }[] = [
  { id: 'mild', base: 1 },
  {
    id: 'moderate',
    base: 2,
  },
  { id: 'serious', base: 4 },
  {
    id: 'critical',
    base: 3,
    urgent:
      'I found an unknown substance in his backpack last night and he will not say what it is.',
  },
];

/** Every string a parent reads, so a rule is checked against the whole plan. */
function proseOf(sections: Section[]): string {
  return sections
    .flatMap((s) => [
      s.body ?? '',
      ...(s.items ?? []),
      ...(s.recommendations ?? []).flatMap((r) => [r.headline, r.body]),
      ...(s.workshops ?? []).map((w) => w.whyThisFamily),
    ])
    .join('\n\n');
}

async function main() {
  const base = process.env.API_BASE ?? 'http://localhost:3500';
  const key = process.env.API_SECRET_KEY;
  if (!key) {
    console.error('API_SECRET_KEY is required.');
    process.exit(1);
  }

  const dir = join(__dirname, '..', 'verification');
  mkdirSync(dir, { recursive: true });

  const phRule = content.workshops.requiredWording.find(
    (r) => r.id === 'professional-help-sequence',
  )!;
  const psRule = content.workshops.requiredWording.find(
    (r) => r.id === 'private-search-line',
  )!;

  let failures = 0;
  const summary: Record<string, unknown> = {};

  for (const testCase of CASES) {
    for (const language of ['en', 'es'] as Language[]) {
      const id = `${testCase.id}-${language}`;
      const responses: Record<string, number> = {};
      for (const question of content.assessment.questions) {
        responses[question.id] = testCase.base;
      }

      process.stdout.write(`${id.padEnd(14)} `);
      const started = Date.now();

      const response = await fetch(`${base}/api/assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          responses,
          language,
          ...(testCase.urgent ? { urgentConcern: testCase.urgent } : {}),
        }),
      });

      if (!response.ok) {
        console.log(`FAILED ${response.status}`);
        failures += 1;
        continue;
      }

      const body = (await response.json()) as {
        severity: { tierId: string };
        report: { sections: Section[] };
      };
      const sections = body.report.sections;
      const prose = proseOf(sections);
      const keys = sections.map((s) => s.key);
      const tier = body.severity.tierId;

      // Every rule that must hold, stated as a claim rather than a hope.
      const mentionsProfessionalHelp = phRule.triggers[language].some((t) =>
        prose.toLowerCase().includes(t.toLowerCase()),
      );
      const describesSearch = psRule.triggers[language].some((t) =>
        prose.toLowerCase().includes(t.toLowerCase()),
      );

      const checks: Record<string, boolean> = {
        'every section written': sections.every(
          (s) =>
            (s.body ?? '').length > 0 ||
            (s.items ?? []).length > 0 ||
            (s.recommendations ?? []).length > 0 ||
            (s.workshops ?? []).length > 0,
        ),
        'professional-help sequence when triggered': !mentionsProfessionalHelp
          ? true
          : phRule.sentences[language].every((s) => prose.includes(s)),
        'private-search line when triggered': !describesSearch
          ? true
          : psRule.sentences[language].some((s) => prose.includes(s)),
        'guiding principles rendered verbatim': content.sections.sections
          .filter((s) => s.type === 'static' && s.key !== 'standardizedClosing')
          .every((s) =>
            keys.includes(s.key)
              ? sections.find((x) => x.key === s.key)?.body ===
                s.text?.[language]
              : true,
          ),
        'standardized closing correct for tier':
          tier === 'mild'
            ? !keys.includes('standardizedClosing')
            : sections.find((s) => s.key === 'standardizedClosing')?.body ===
              content.sections.sections.find(
                (s) => s.key === 'standardizedClosing',
              )?.text?.[language],
        'urgent sections correct for input': testCase.urgent
          ? keys.includes('urgentConcern') &&
            keys.includes('consideringInpatient')
          : !keys.includes('urgentConcern') &&
            !keys.includes('consideringInpatient'),
        'peer-support group cited': prose.includes(
          'Monitoring and Intervention discussion group',
        ),
        // Tier-aware, exactly as the service is. Checking every rule at every
        // tier flagged a MODERATE plan for a phrase the methodology only bans at
        // SERIOUS — a false alarm in the checker, not a defect in the plan.
        'no banned vocabulary': !content
          .voiceRulesFor(tier)
          .filter((r) => r.strictness === 'retry')
          .some((r) =>
            r.terms[language].some((term) =>
              r.kind === 'words'
                ? new RegExp(`\\b${term}\\b`, 'i').test(stripApproved(prose))
                : stripApproved(prose)
                    .toLowerCase()
                    .includes(term.toLowerCase()),
            ),
          ),
        'no answer label quoted': !content.assessment.questions
          .map(
            (q) =>
              q.options.find((o) => o.value === testCase.base)?.label[language],
          )
          .filter((l): l is string => !!l)
          .filter((l) => l.split(/\s+/).length >= 4)
          .some((l) => prose.includes(l)),
        'workshop titles never translated': (
          sections.find((s) => s.type === 'workshopList')?.workshops ?? []
        ).every((w) =>
          content.workshops.workshops.some((c) => c.title === w.title),
        ),
      };

      const failed = Object.entries(checks).filter(([, ok]) => !ok);
      failures += failed.length;

      console.log(
        `${tier.padEnd(9)} ${sections.length} sections  ${Math.round((Date.now() - started) / 1000)}s  ` +
          (failed.length === 0
            ? 'all checks pass'
            : `FAILED: ${failed.map(([n]) => n).join('; ')}`),
      );

      writeFileSync(
        join(dir, `${id}.json`),
        `${JSON.stringify({ tier, checks, sections }, null, 2)}\n`,
        'utf8',
      );
      summary[id] = { tier, sections: sections.length, checks };
    }
  }

  writeFileSync(
    join(dir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  console.log(
    failures === 0
      ? '\nEvery plan satisfied every rule.'
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

/** Banned words appear inside approved titles; strip them first (see voice.json). */
function stripApproved(text: string): string {
  let out = text;
  for (const phrase of [
    ...content.workshops.workshops.map((w) => w.title),
    ...content.workshops.discussionGroups.map((g) => g.name),
    ...content.workshops.requiredWording.flatMap((r) => [
      ...r.sentences.en,
      ...r.sentences.es,
    ]),
  ].sort((a, b) => b.length - a.length)) {
    out = out.split(phrase).join(' ');
  }
  return out;
}

void main();
