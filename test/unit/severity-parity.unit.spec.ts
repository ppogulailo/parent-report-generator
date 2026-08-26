import { expect, test } from '@playwright/test';
import { loadContent } from '../../src/content/content.loader';
import { evaluate } from '../../src/selection/rule.evaluator';
import type { ScoredSubmission } from '../../src/selection/selection.types';
import { computeSeverityTier } from '../../src/report/prompts/user.prompt';
import { DOMAIN_MAP } from '../../src/report/scoring/domain.map';

/**
 * THE PARITY SWEEP.
 *
 * Milestone 1's promise is that moving the methodology into structured logic
 * does not change what it decides. This is the test that holds us to it: for
 * tens of thousands of submissions, the tier the transcribed matrix resolves
 * must equal the tier the live `computeSeverityTier` returns.
 *
 * It compares against the live implementation directly rather than against
 * recorded expectations, so it cannot drift: if someone edits the tier rules in
 * `content/recommendation-matrix.json`, this fails immediately and names the
 * exact submission that diverged.
 *
 * ONE APPROVED DIVERGENCE EXISTS. Dave approved adding Q4 to Immediate Safety
 * & Urgency (via Matt, 2026-08-25, RECOMMENDATION-MATRIX.md §6.1), and the old
 * path's DOMAIN_MAP deliberately does not receive it — that path still serves
 * parents until the switchover and must not move. The sweep applies the same
 * amendment to the live arithmetic below, so what it proves is that the tier
 * LOGIC is identical given identical domain scores: any divergence beyond the
 * approved one still fails.
 *
 * The live function returns MILD | MODERATE | SERIOUS. The matrix additionally
 * distinguishes CRITICAL, which the live system expresses as "SERIOUS, plus the
 * two urgent-only sections" — so `critical` maps to SERIOUS here. That mapping
 * IS the claim being tested: a parent who writes in the urgent field must still
 * land in the SERIOUS register and never in MILD.
 */

const content = loadContent(process.cwd() + '/content');
const QUESTION_IDS = content.assessment.questions.map((q) => q.id);

/** Mirrors ScoringService, so the sweep exercises the shipped arithmetic rather
 *  than a copy of it: domain averages rounded to 2dp, overall average NOT
 *  rounded, missing answers filled with the floored midpoint. */
function score(responses: number[], urgentText?: string): ScoredSubmission {
  const normalisedResponses: Record<string, number> = {};
  QUESTION_IDS.forEach((id, index) => {
    const value = responses[index];
    normalisedResponses[id] =
      value === undefined || Number.isNaN(value)
        ? 2
        : Math.min(4, Math.max(1, value));
  });

  const domainScores: Record<string, number> = {};
  for (const domain of content.assessment.domains) {
    const values = domain.questionIds.map((id) => normalisedResponses[id]);
    domainScores[domain.id] =
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
      100;
  }
  const domainValues = Object.values(domainScores);

  const valueCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const value of Object.values(normalisedResponses)) {
    valueCounts[value] = (valueCounts[value] ?? 0) + 1;
  }

  return {
    domainScores,
    overallAverage:
      domainValues.reduce((a, b) => a + b, 0) / domainValues.length,
    topDomains: [],
    normalisedResponses,
    valueCounts,
    urgentTextPresent: (urgentText ?? '').trim().length > 0,
    gateAnswers: {},
  };
}

/** The old path's map plus the one approved amendment: Q4 (index 3) joins
 *  Immediate Safety & Urgency. See the header comment — amending the copy here
 *  rather than DOMAIN_MAP itself is what keeps the old path untouched. */
const AMENDED_DOMAIN_MAP: Record<string, number[]> = {
  ...DOMAIN_MAP,
  'Immediate Safety & Urgency': [
    ...DOMAIN_MAP['Immediate Safety & Urgency'],
    3,
  ],
};

/** The live scorer's domain map keyed by label, which `computeSeverityTier`
 *  expects. Built from the same responses so both sides see identical input. */
function liveDomainScores(responses: number[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [label, indices] of Object.entries(AMENDED_DOMAIN_MAP)) {
    const values = indices.map((i) => {
      const value = responses[i];
      return value === undefined ? 2 : Math.min(4, Math.max(1, value));
    });
    scores[label] =
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
      100;
  }
  return scores;
}

function matrixTier(responses: number[], urgentText?: string): string {
  const scored = score(responses, urgentText);
  const tier = content.matrix.tiers.find((t) => evaluate(t.when, scored));
  if (!tier) throw new Error('no tier matched — the matrix has no catch-all');
  return tier.id;
}

/** `critical` is the live SERIOUS register plus the urgent-only sections. */
const asLiveTier = (tierId: string): 'MILD' | 'MODERATE' | 'SERIOUS' =>
  tierId === 'critical'
    ? 'SERIOUS'
    : (tierId.toUpperCase() as 'MILD' | 'MODERATE' | 'SERIOUS');

/** Deterministic PRNG — a fixed seed means a failure is always reproducible.
 *  `Math.random()` here would make a red build impossible to investigate. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('every uniform submission resolves to the same tier as the live logic', () => {
  for (const value of [1, 2, 3, 4]) {
    const responses = Array<number>(24).fill(value);
    expect(asLiveTier(matrixTier(responses)), `all-${value}s`).toBe(
      computeSeverityTier(responses, liveDomainScores(responses)),
    );
  }
});

test('30,000 random submissions resolve to the same tier as the live logic', () => {
  const random = mulberry32(20260823);
  const divergences: string[] = [];

  for (let i = 0; i < 30_000; i++) {
    const responses = Array.from(
      { length: 24 },
      () => Math.floor(random() * 4) + 1,
    );
    const mine = asLiveTier(matrixTier(responses));
    const live = computeSeverityTier(responses, liveDomainScores(responses));
    if (mine !== live) {
      divergences.push(`[${responses.join(',')}] matrix=${mine} live=${live}`);
      if (divergences.length >= 5) break;
    }
  }

  expect(divergences, divergences.join('\n')).toEqual([]);
});

test('a single 4 on each question in turn matches the live logic', () => {
  // Targets the fours-count pathway's child-safety requirement, which uniform
  // and random vectors exercise only incidentally.
  for (let target = 0; target < 24; target++) {
    for (const base of [1, 2, 3]) {
      const responses = Array<number>(24).fill(base);
      responses[target] = 4;
      expect(
        asLiveTier(matrixTier(responses)),
        `Q${target + 1}=4 over a base of ${base}`,
      ).toBe(computeSeverityTier(responses, liveDomainScores(responses)));
    }
  }
});

test('three 4s promote to SERIOUS only when one of them is a child-safety question', () => {
  // The load-bearing half of the third SERIOUS pathway. Without it, a household
  // under strain with no use or safety signal is handed an intervention plan.
  const childSafety = [0, 1, 9];
  const nonSafety = [4, 7, 16]; // conflict intensity, over/under-reacting, exhaustion

  const strained = Array<number>(24).fill(1);
  for (const i of nonSafety) strained[i] = 4;
  expect(matrixTier(strained), 'three 4s, none child-safety').toBe('moderate');

  const withSafety = Array<number>(24).fill(1);
  withSafety[nonSafety[0]] = 4;
  withSafety[nonSafety[1]] = 4;
  withSafety[childSafety[2]] = 4;
  expect(matrixTier(withSafety), 'three 4s, one child-safety').toBe('serious');

  // Both agree with the live logic, which is the point.
  for (const responses of [strained, withSafety]) {
    expect(asLiveTier(matrixTier(responses))).toBe(
      computeSeverityTier(responses, liveDomainScores(responses)),
    );
  }
});

test('urgent text is a hard escalator out of MILD, whatever the scores say', () => {
  const calmest = Array<number>(24).fill(1);
  expect(matrixTier(calmest)).toBe('mild');
  expect(matrixTier(calmest, 'I found something in his room last night.')).toBe(
    'critical',
  );
  // Whitespace is not a concern. The live gate trims before testing, and a
  // stray space must not hand a family the crisis report.
  expect(matrixTier(calmest, '   ')).toBe('mild');
});

test('q23 and q24 cannot promote a family on their own', () => {
  // Founder direction, 2026-05-19: parent worry and parent readiness belong to
  // the safety domain for scoring but are excluded from the subset that
  // independently promotes to SERIOUS. If a future edit adds them back to the
  // child-safety subset, this fails.
  const responses = Array<number>(24).fill(1);
  responses[22] = 4; // q23 — worry about long-term consequences
  responses[23] = 4; // q24 — readiness to act
  expect(matrixTier(responses)).not.toBe('serious');
  expect(asLiveTier(matrixTier(responses))).toBe(
    computeSeverityTier(responses, liveDomainScores(responses)),
  );
});
