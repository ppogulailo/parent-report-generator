import type { Language } from '../content/content.types';
import type { VoiceRule } from '../content/schemas/voice.schema';
import type {
  RequiredWording,
  Workshops,
} from '../content/schemas/workshops.schema';

/**
 * Verifies the generated prose against the wording rules, and against the
 * banned titles.
 *
 * This exists because the prompt alone produced intermittent compliance. During
 * Sustaining Recovery testing the founder-approved professional-help sequence —
 * the sentences that give a parent an actual route to ASAP's vetted providers —
 * was present in one live report and absent from six paragraphs of another
 * generated two days earlier. Nothing checked, so nothing noticed. Intermittent
 * is worse than broken: a parent quietly never receives the route, and no log
 * line anywhere says so.
 *
 * A violation is fed back to the model and the report is regenerated. If it
 * survives every attempt the report still ships, with a loud warning — losing a
 * parent's whole plan over wording is the worse outcome.
 */

export interface WordingViolation {
  ruleId: string;
  detail: string;
}

/**
 * Keys whose values are ids, not prose.
 *
 * **Excluding these is load-bearing.** Workshop and recommendation ids contain
 * words like `professional` (`aux-when-is-it-time-for-professional`) and
 * `search` (`aux-how-and-when-to-search-a`). Walking them made every report look
 * like it had triggered every rule, which is how a checker becomes noise and
 * then gets switched off.
 */
const ID_KEYS = new Set(['recommendationId', 'workshopId']);

/** Every string in the report that a parent will actually read. */
export function proseOf(report: Record<string, unknown>): string[] {
  const out: string[] = [];

  const walk = (value: unknown, key?: string): void => {
    if (key !== undefined && ID_KEYS.has(key)) return;
    if (typeof value === 'string') {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, childKey);
      }
    }
  };

  walk(report);
  return out;
}

const normalise = (text: string): string =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const contains = (haystack: string, needle: string): boolean =>
  normalise(haystack).includes(normalise(needle));

export function checkRequiredWording(
  report: Record<string, unknown>,
  rules: RequiredWording[],
  language: Language,
): WordingViolation[] {
  const violations: WordingViolation[] = [];
  const prose = proseOf(report);
  const whole = prose.join('\n\n');

  for (const rule of rules) {
    if (rule.strictness === 'warn') continue;

    const triggers = rule.triggers[language];
    const sentences = rule.sentences[language];

    if (rule.scope === 'at-least-once') {
      const triggered = triggers.some((t) => contains(whole, t));
      if (!triggered) continue;

      const missing = sentences.filter((s) => !contains(whole, s));
      if (missing.length > 0) {
        violations.push({
          ruleId: rule.id,
          detail: `the plan refers to ${triggers.filter((t) => contains(whole, t)).join(', ')} but is missing the required wording: ${missing.map((s) => `"${s}"`).join(' ')}`,
        });
      }
      continue;
    }

    // every-paragraph
    for (const paragraph of prose.flatMap((block) => block.split(/\n{2,}/))) {
      if (!triggers.some((t) => contains(paragraph, t))) continue;
      const missing = sentences.filter((s) => !contains(paragraph, s));
      if (missing.length > 0) {
        violations.push({
          ruleId: rule.id,
          detail: `a paragraph refers to ${triggers.filter((t) => contains(paragraph, t)).join(', ')} without the required wording. The paragraph begins: "${paragraph.slice(0, 120)}…"`,
        });
      }
    }
  }

  return violations;
}

/**
 * Titles that must never reach a parent — hallucinated resources, retired ones,
 * and real workshops this plan excludes.
 *
 * Checked against the prose rather than trusted to the prompt, because a title
 * the model remembers from its training data is exactly the kind of thing an
 * instruction fails to suppress. The Articles of Action are included: they are
 * foundational text taught inside the workshops, and the methodology forbids
 * recommending one to a parent as reading.
 */
export function checkBannedTitles(
  report: Record<string, unknown>,
  workshops: Workshops,
): WordingViolation[] {
  const whole = proseOf(report).join('\n\n');
  const violations: WordingViolation[] = [];

  for (const title of workshops.bannedTitles.workshops) {
    if (contains(whole, title)) {
      violations.push({
        ruleId: 'banned-workshop-title',
        detail: `"${title}" must never appear in a plan. Remove it and, if a resource is needed there, use one that was selected for this family.`,
      });
    }
  }

  for (const name of workshops.bannedTitles.discussionGroups) {
    if (contains(whole, name)) {
      violations.push({
        ruleId: 'banned-discussion-group',
        detail: `"${name}" is not an approved discussion group and must not appear.`,
      });
    }
  }

  for (const title of workshops.bannedTitles.articlesOfAction) {
    if (contains(whole, title)) {
      violations.push({
        ruleId: 'article-of-action-cited',
        detail: `"${title}" is an Article of Action. It is taught inside the workshops and must never be recommended to a parent as reading — cite the workshop instead.`,
      });
    }
  }

  return violations;
}

/**
 * A resource the family was not given, appearing in the prose.
 *
 * The schema already guarantees the structured workshop list is exactly the
 * selected set. This catches the looser failure: a workshop correctly absent
 * from that list but named in a paragraph anyway.
 *
 * **Required wording is exempt, and must be.** The professional-help sequence
 * names the Sustaining Recovery discussion group in its first sentence, and the
 * matrix does not route that group to anybody — so without this exemption the
 * two rules contradict each other: satisfying the wording rule would guarantee
 * violating this one, and no response could ever pass. Approved program wording
 * that names a resource is itself the authorisation to name it.
 *
 * `rulesInForce` is tier-filtered by the caller, so the exemption respects tier
 * gating: the standardized closing names the Protecting Recovery workshop and
 * group, and because that rule does not apply in MILD, neither does its
 * exemption.
 */
export function checkUnselectedResources(
  report: Record<string, unknown>,
  workshops: Workshops,
  selectedWorkshopIds: string[],
  selectedGroupIds: string[],
  rulesInForce: RequiredWording[] = [],
): WordingViolation[] {
  const whole = proseOf(report).join('\n\n');
  const violations: WordingViolation[] = [];

  const approvedWording = rulesInForce
    .flatMap((rule) => [...rule.sentences.en, ...rule.sentences.es])
    .join('\n');
  const namedByApprovedWording = (name: string): boolean =>
    contains(approvedWording, name);

  for (const workshop of workshops.workshops) {
    if (selectedWorkshopIds.includes(workshop.id)) continue;
    if (namedByApprovedWording(workshop.title)) continue;
    if (contains(whole, workshop.title)) {
      violations.push({
        ruleId: 'unselected-workshop',
        detail: `"${workshop.title}" was not selected for this family and must not be cited. Only these may appear: ${selectedWorkshopIds
          .map(
            (id) =>
              `"${workshops.workshops.find((w) => w.id === id)?.title ?? id}"`,
          )
          .join(', ')}.`,
      });
    }
  }

  for (const group of workshops.discussionGroups) {
    if (selectedGroupIds.includes(group.id)) continue;
    if (namedByApprovedWording(`${group.name} discussion group`)) continue;
    // Matched with the "discussion group" suffix: the bare names collide with
    // workshop titles and with the standardized closing's own wording.
    if (contains(whole, `${group.name} discussion group`)) {
      violations.push({
        ruleId: 'unselected-discussion-group',
        detail: `the "${group.name} discussion group" was not selected for this family and must not be cited.`,
      });
    }
  }

  return violations;
}

/**
 * Escapes a term for use inside a regular expression.
 *
 * Necessary because banned terms are content, and content contains `[`, `(` and
 * `.` — `"[sequence]"` is one of the banned placeholders, and unescaped it is a
 * character class matching the letters s, e, q, u, n and c.
 */
const escapeRegExp = (term: string): string =>
  term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The prose with approved wording removed, ready for banned-term matching.
 *
 * **This is what makes the voice rules usable rather than noise.** Three of the
 * banned words occur inside approved workshop titles — "Engagement" in the
 * Effective Communication workshop, "Dynamics" in Family Dynamics,
 * "Reinforcement" in Positive Reinforcement — and the professional-help sequence
 * is itself required wording. Matching without stripping these would flag every
 * correctly-written report, and a checker that always fires gets turned off.
 */
export function proseWithoutApprovedWording(
  report: Record<string, unknown>,
  workshops: Workshops,
): string {
  let text = proseOf(report).join('\n\n');

  const approved = [
    ...workshops.workshops.map((w) => w.title),
    ...workshops.discussionGroups.map((g) => `${g.name} discussion group`),
    ...workshops.discussionGroups.map((g) => g.name),
    ...workshops.requiredWording.flatMap((r) => [
      ...r.sentences.en,
      ...r.sentences.es,
    ]),
    // Longest first, so a title containing another title is removed whole rather
    // than leaving a fragment behind that then matches something else.
  ].sort((a, b) => b.length - a.length);

  for (const phrase of approved) {
    text = text.replace(new RegExp(escapeRegExp(phrase), 'gi'), ' ');
  }

  return text;
}

/**
 * Checks the prose against the voice rules.
 *
 * These exist only as prompt instructions in the live system: the model is told
 * not to write "foster" or "You are not alone", and nothing has ever verified
 * that it didn't. Unlike a missing workshop, this class of failure survives
 * close reading — a plan full of "facilitate" and "holistic" still looks like a
 * plan, it just doesn't sound like ASAP.
 */
export function checkVoice(
  report: Record<string, unknown>,
  rules: VoiceRule[],
  workshops: Workshops,
  language: Language,
): WordingViolation[] {
  const text = proseWithoutApprovedWording(report, workshops);
  const violations: WordingViolation[] = [];

  for (const rule of rules) {
    if (rule.strictness === 'warn') continue;

    const found = rule.terms[language].filter((term) => {
      const pattern =
        rule.kind === 'words'
          ? new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i')
          : new RegExp(escapeRegExp(term), 'i');
      return pattern.test(text);
    });

    if (found.length > 0) {
      violations.push({
        ruleId: rule.id,
        detail: `${found.map((t) => `"${t}"`).join(', ')} must not appear. ${rule.reason}`,
      });
    }
  }

  return violations;
}

/**
 * Catches an answer label quoted verbatim back at the parent.
 *
 * The labels are intake-form options. Quoting one — 'your "Near-daily — running
 * on empty" exhaustion' — is the clearest single tell that a plan was assembled
 * from a form rather than written about a family, and it is the kind of thing a
 * reader notices immediately and cannot unsee.
 *
 * Only the labels the parent actually chose are checked, and only the longer
 * ones: "Always consistent" occurs in ordinary prose.
 */
export function checkAnswerLabels(
  report: Record<string, unknown>,
  chosenLabels: string[],
  minWords: number,
): WordingViolation[] {
  const text = normalise(proseOf(report).join('\n\n'));

  const quoted = chosenLabels
    .filter((label) => label.trim().split(/\s+/).length >= minWords)
    .filter((label) => text.includes(normalise(label)));

  if (quoted.length === 0) return [];

  return [
    {
      ruleId: 'answer-label-quoted',
      detail: `${quoted.map((l) => `"${l}"`).join(', ')} — these are questionnaire options, not something the parent said. Describe what they reported in natural words instead: "the near-daily exhaustion you described", not the label itself.`,
    },
  ];
}
