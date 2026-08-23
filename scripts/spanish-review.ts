/**
 * Emits SPANISH-REVIEW.md — every Spanish string introduced by Version 1.0, for
 * native-speaker sign-off.
 *
 * Generated rather than written by hand so the list cannot drift from the
 * content. Re-run it after any content edit and the review pack is current.
 *
 *   npx ts-node scripts/spanish-review.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent, resolveContentDir } from '../src/content/content.loader';

interface Entry {
  where: string;
  en: string;
  es: string;
}

const bundle = loadContent(resolveContentDir());
const entries: Entry[] = [];

const add = (where: string, pair: { en: string; es: string }): void => {
  entries.push({ where, en: pair.en, es: pair.es });
};

// Severity tiers — a parent reads `description`; `toneGuidance` is an
// instruction to the model and is deliberately not listed for translation.
for (const tier of bundle.matrix.tiers) {
  add(`tier "${tier.id}" — label`, tier.label);
  add(`tier "${tier.id}" — description`, tier.description);
}

// The priority areas. `intent` reaches a parent only as the spine of the prose
// the model writes from it, but a mistranslated intent produces a mistranslated
// plan, so it is reviewed too.
for (const rec of bundle.matrix.recommendations) {
  add(`priority "${rec.id}" — title`, rec.title);
  add(`priority "${rec.id}" — intent`, rec.intent);
}

// Report sections: titles a parent sees, instructions the model follows, and the
// static passages that ship verbatim.
for (const section of bundle.sections.sections) {
  add(`section "${section.key}" — title`, section.title);
  if (section.instruction) {
    add(`section "${section.key}" — instruction`, section.instruction);
  }
  if (section.text) {
    add(`section "${section.key}" — VERBATIM TEXT`, section.text);
  }
}

// The assessment.
add('assessment — title', bundle.assessment.title);
add('assessment — intro', bundle.assessment.intro);
for (const question of bundle.assessment.questions) {
  add(`${question.id} — prompt`, question.prompt);
  for (const option of question.options) {
    add(`${question.id} — option ${option.value}`, option.label);
  }
}
for (const gate of bundle.assessment.gates) {
  add(`gate "${gate.id}" — prompt`, gate.prompt);
  if (gate.help) add(`gate "${gate.id}" — help`, gate.help);
  for (const option of gate.options) {
    add(`gate "${gate.id}" — option "${option.value}"`, option.label);
  }
}
add('urgent field — label', bundle.assessment.urgentField.label);
add('urgent field — help', bundle.assessment.urgentField.help);
add('urgent field — placeholder', bundle.assessment.urgentField.placeholder);

// The resource category labels and the required wording are where "identical in
// both languages" is the correct answer rather than an oversight, so they are
// listed explicitly.
add('workshop category — essential', bundle.workshops.categoryLabels.essential);
add('workshop category — auxiliary', bundle.workshops.categoryLabels.auxiliary);
for (const rule of bundle.workshops.requiredWording) {
  rule.sentences.en.forEach((sentence, index) => {
    add(`required wording "${rule.id}" — sentence ${index + 1}`, {
      en: sentence,
      es: rule.sentences.es[index] ?? '',
    });
  });
  add(`required wording "${rule.id}" — trigger terms`, {
    en: rule.triggers.en.join(', '),
    es: rule.triggers.es.join(', '),
  });
}

for (const domain of bundle.assessment.domains) {
  add(`domain "${domain.id}" — label`, domain.label);
  add(`domain "${domain.id}" — description`, domain.description);
}

const untranslated = entries.filter((e) => e.en === e.es);
const carriedOver = entries.filter(
  (e) => e.where.includes('— prompt') || e.where.includes('— option'),
);

const doc = `# Spanish review — Monitoring & Intervention Version 1.0

**For native-speaker sign-off.** Generated from \`content/\` by
\`scripts/spanish-review.ts\` on request, so it cannot drift from what ships.
Re-run it after any content edit.

${entries.length} strings, of which ${carriedOver.length} are the existing
questionnaire wording carried over unchanged from the live system and need no
review unless something was already wrong.

## How Spanish works here now

In the live system, English and Spanish are two separately maintained prompt
files kept in step by hand — 39 rule headings on one side, 21 on the other. After
this upgrade the rules live once, as data, with both languages side by side in the
same record. The schema requires both: a missing translation fails at boot rather
than shipping a blank section to a Spanish-speaking parent. That is what makes
this class of drift structurally hard rather than a matter of discipline.

## What stays in English, deliberately

${untranslated.length} strings are identical in both languages, and should be:

${untranslated.map((e) => `- **${e.where}** — \`${e.es}\``).join('\n') || '- (none)'}

Workshop titles, discussion group names, and the two sentences of the
professional-help sequence are program resource names and locations, not prose.
They are cited verbatim in Spanish reports, per existing founder direction.

## Priority for review

Read these first — they ship **verbatim** to a parent, with no model involved:

${entries
  .filter((e) => e.where.includes('VERBATIM'))
  .map((e) => `### ${e.where}\n\n**EN**\n\n${e.en}\n\n**ES**\n\n${e.es}\n`)
  .join('\n')}

## Everything else

| Where | English | Spanish |
|---|---|---|
${entries
  .filter((e) => !e.where.includes('VERBATIM') && e.en !== e.es)
  .map(
    (e) =>
      `| ${e.where} | ${e.en.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${e.es
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')} |`,
  )
  .join('\n')}

---

*Corrections can be made directly in \`content/\` — every string above is a JSON
edit, and none requires a code change.*
`;

const target = join(__dirname, '..', 'SPANISH-REVIEW.md');
writeFileSync(target, doc, 'utf8');
console.log(
  `wrote ${target} — ${entries.length} strings, ${untranslated.length} intentionally untranslated`,
);
