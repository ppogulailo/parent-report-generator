import { expect, test } from '@playwright/test';
import { ContentService } from '../../src/content/content.service';
import { evaluate } from '../../src/selection/rule.evaluator';
import { ScoringService } from '../../src/selection/scoring.service';
import { SelectionService } from '../../src/selection/selection.service';
import type { Responses } from '../../src/selection/selection.types';

/**
 * The selection engine's guarantees, exercised against the SHIPPED content.
 *
 * Running against `content/` rather than a fixture is deliberate here: these
 * tests are as much a check on the transcribed matrix as on the engine, and a
 * fixture would let a broken routing rule pass. The trade-off is that a
 * deliberate content revision will break assertions that name specific
 * recommendations — which is the correct outcome, because such a revision is a
 * methodology change and should be noticed.
 */

const content = new ContentService();
const selection = new SelectionService(content, new ScoringService(content));

/** A submission with every question at `base`, then specific overrides. */
function submission(base: number, overrides: Responses = {}): Responses {
  const responses: Responses = {};
  for (const question of content.assessment.questions) {
    responses[question.id] = base;
  }
  return { ...responses, ...overrides };
}

test('every family receives exactly one primary recommendation', () => {
  for (const base of [1, 2, 3, 4]) {
    const result = selection.select(submission(base));
    expect(result.primary, `all-${base}s`).toBeTruthy();
    expect(result.primary.role).toBe('primary');
    expect(
      result.supporting.some((s) => s.id === result.primary.id),
      'the primary must not also appear as supporting',
    ).toBe(false);
  }
});

test('the calmest possible submission still receives a real primary, not a fallback', () => {
  // parent-emotional-regulation is defaultPrimary AND has an always-true rule,
  // so it is selected on merit rather than reached through the fallback path.
  // A matrix where the fallback fires routinely is under-specified.
  const result = selection.select(submission(1));
  expect(result.audit.usedDefaultPrimary).toBe(false);
  expect(result.primary.id).toBe('parent-emotional-regulation');
});

test('the parent peer-support group reaches every report, at every tier', () => {
  // The methodology states this as an absolute: the Monitoring and Intervention
  // discussion group is the parent's canonical support routing at every
  // severity, with no gating.
  const seen = new Set<string>();
  for (const base of [1, 2, 3, 4]) {
    const result = selection.select(submission(base));
    seen.add(result.tierId);
    expect(
      result.discussionGroupIds,
      `tier ${result.tierId} must route to the parent's group`,
    ).toContain('dg-monitoring-intervention');
  }
  const urgent = selection.select(submission(1), 'something happened tonight');
  seen.add(urgent.tierId);
  expect(urgent.discussionGroupIds).toContain('dg-monitoring-intervention');

  // Confirms the loop actually covered the range rather than landing in one
  // tier four times.
  expect([...seen].sort()).toEqual(['critical', 'mild', 'moderate', 'serious']);
});

test('nothing is dropped for exceeding the supporting cap', () => {
  // maxSupporting is deliberately above the number of rules that can match, so
  // the live "cite every matching resource" behaviour is preserved. If someone
  // lowers it, this fails and names what would have been silently cut.
  const result = selection.select(submission(4), 'urgent');
  const capped = result.audit.exclusions.filter(
    (e) => e.reason === 'over-max-supporting',
  );
  expect(capped, JSON.stringify(capped)).toEqual([]);
});

test('"Early Warning Signs" cannot reach a SERIOUS or CRITICAL plan', () => {
  // The parent is past the awareness stage. Under the prompt-only system this
  // was an instruction; here the workshop is removed before the model is told
  // what exists.
  const serious = selection.select(submission(4));
  expect(serious.tierId).toBe('serious');
  expect(serious.workshopIds).not.toContain(
    'aux-early-warning-signs-identifying-substance-use',
  );

  const critical = selection.select(submission(1), 'I found something.');
  expect(critical.tierId).toBe('critical');
  expect(critical.workshopIds).not.toContain(
    'aux-early-warning-signs-identifying-substance-use',
  );
});

test('drug testing and behavioural contracts cannot reach a MILD plan', () => {
  // Both belong to the MODERATE/SERIOUS register. Reaching them in MILD would
  // escalate a household that has shown no use signal.
  const mild = selection.select(
    submission(1, { q07: 3, q19: 3 }), // fires the consequences rule
  );
  expect(mild.tierId).toBe('mild');
  expect(mild.workshopIds).not.toContain('aux-drug-testing');
  expect(mild.workshopIds).not.toContain(
    'aux-behavioral-contracts-a-tool-for-positive',
  );
  // ...and the priority area still has a resource to cite, which is the thing
  // boot validation guarantees and this proves at runtime.
  expect(mild.workshopIds).toContain(
    'aux-setting-boundaries-with-respect-discipline-without',
  );
  expect(mild.audit.tierGatedWorkshopIds).toContain(
    'aux-behavioral-contracts-a-tool-for-positive',
  );
});

test('a gated resource is recorded in the audit rather than vanishing', () => {
  // The MILD case is the one that genuinely exercises gating: the consequences
  // rule selects behavioural contracts, and the tier gate then removes it.
  const mild = selection.select(submission(1, { q07: 3, q19: 3 }));
  const gated = mild.audit.exclusions.filter(
    (e) => e.reason === 'forbidden-at-tier',
  );
  expect(gated.length).toBeGreaterThan(0);
  for (const record of gated) {
    expect(record.excludedBy).toBe(`tier=${mild.tierId}`);
  }
  expect(mild.audit.tierGatedWorkshopIds).toEqual(
    gated.map((g) => g.droppedId),
  );
});

test('"Early Warning Signs" is routed at Mild and gated out of Serious', () => {
  // This test used to assert the workshop was unroutable, which it was — and
  // that turned out to be the bug: a Mild family matched no workshop-bearing
  // rule and received a plan with no workshop in it. The preventative rule now
  // routes it, which makes the tier gate load-bearing rather than a dormant
  // backstop: the same workshop must reach a Mild plan and must not reach a
  // Serious one, where the parent is past the awareness stage.
  const EARLY = 'aux-early-warning-signs-identifying-substance-use';

  const mild = selection.select(submission(1));
  expect(mild.tierId).toBe('mild');
  expect(mild.workshopIds).toContain(EARLY);

  const moderate = selection.select(submission(2));
  expect(moderate.tierId).toBe('moderate');
  expect(moderate.workshopIds).toContain(EARLY);

  const serious = selection.select(submission(4));
  expect(serious.tierId).toBe('serious');
  expect(serious.workshopIds).not.toContain(EARLY);

  const critical = selection.select(submission(1), 'I found something.');
  expect(critical.tierId).toBe('critical');
  expect(critical.workshopIds).not.toContain(EARLY);
});

test('no plan, at any severity, comes out with zero workshops', () => {
  // The failure that produced the rule above: a heading reading "The workshops
  // for your situation" with nothing under it, in every Mild and Moderate plan.
  for (const base of [1, 2, 3, 4]) {
    const result = selection.select(submission(base));
    expect(result.workshopIds.length, `all-${base}s`).toBeGreaterThan(0);
  }
  const urgent = selection.select(submission(1), 'something happened');
  expect(urgent.workshopIds.length, 'critical').toBeGreaterThan(0);
});

test('the routing table fires on the questions it names', () => {
  const cases: Array<{
    overrides: Responses;
    expectWorkshop: string;
    why: string;
  }> = [
    {
      overrides: { q12: 3 },
      expectWorkshop: 'aux-understanding-and-navigating-peer-pressure',
      why: 'negative peers (q12 >= 3)',
    },
    {
      overrides: { q03: 3 },
      expectWorkshop: 'aux-how-and-when-to-search-a',
      why: 'secrecy (q03 >= 3)',
    },
    {
      overrides: { q15: 3 },
      expectWorkshop: 'aux-partnering-with-schools-for-your-childs',
      why: 'school disengagement (q15 >= 3)',
    },
    {
      overrides: { q09: 3 },
      expectWorkshop: 'aux-managing-stress-and-pressure-helping-your',
      why: 'mood signals (q09 >= 3)',
    },
    {
      overrides: { q14: 3, q12: 2 },
      expectWorkshop: 'aux-understanding-the-impact-of-social-media',
      why: 'unmonitored phone with peer risk (q14 >= 3 AND q12 >= 2)',
    },
    {
      overrides: { q11: 3 },
      expectWorkshop: 'ess-building-a-support-network',
      why: 'weak co-parent alignment (q11 >= 3)',
    },
  ];

  for (const { overrides, expectWorkshop, why } of cases) {
    const result = selection.select(submission(1, overrides));
    expect(result.workshopIds, why).toContain(expectWorkshop);
  }
});

test('the school row cites both of its resources, never just one', () => {
  // The routing table names two and says citing one is a violation. In the live
  // system that depends on the model reading the word "AND".
  const result = selection.select(submission(1, { q15: 3 }));
  expect(result.workshopIds).toContain(
    'aux-partnering-with-schools-for-your-childs',
  );
  expect(result.workshopIds).toContain('ess-building-a-support-network');
});

test('selection is reproducible: the same submission always decides the same way', () => {
  const responses = submission(2, { q03: 4, q11: 3, q15: 3, q17: 4 });
  const first = selection.select(responses);
  const second = selection.select(responses);
  expect(second.tierId).toBe(first.tierId);
  expect(second.primary.id).toBe(first.primary.id);
  expect(second.supporting.map((s) => s.id)).toEqual(
    first.supporting.map((s) => s.id),
  );
  expect(second.workshopIds).toEqual(first.workshopIds);
});

test('supporting recommendations are ordered by impact, deterministically', () => {
  const result = selection.select(submission(3, { q03: 4, q11: 4, q15: 4 }));
  const impacts = result.supporting.map((s) => s.educationalImpact);
  expect(
    [...impacts].sort((a, b) => b - a),
    'supporting set must already be in descending impact order',
  ).toEqual(impacts);
});

test('the disabled routing rows never fire', () => {
  // legal-exposure and lgbtq-specific-risk fire on free text the matrix cannot
  // read. They are { "always": false } until ASAP decides how they should work,
  // and must not leak into a report in the meantime.
  for (const base of [1, 2, 3, 4]) {
    const result = selection.select(submission(base), 'urgent text here');
    expect(result.audit.matchedRecommendationIds).not.toContain(
      'legal-exposure',
    );
    expect(result.audit.matchedRecommendationIds).not.toContain(
      'lgbtq-specific-risk',
    );
  }
});

test('the Sustaining Recovery transition fires on the gate, never on scores', () => {
  const applies = (result: ReturnType<typeof selection.select>): boolean =>
    content
      .sectionsFor(result.tierId, (section) =>
        section.when ? evaluate(section.when, result.scored) : true,
      )
      .some((s) => s.key === 'sustainingRecoveryTransition');

  // No gate answer: never, at any severity. This is the failure mode the gate
  // exists to prevent — a calm, early-stage family being pointed at a
  // post-treatment workshop because their scores happened to be low.
  for (const base of [1, 2, 3, 4]) {
    expect(applies(selection.select(submission(base))), `all-${base}s`).toBe(
      false,
    );
  }

  // Every other gate answer: still never.
  for (const value of [
    'none',
    'seeking',
    'in-treatment',
    'post-treatment-unstable',
  ]) {
    expect(
      applies(
        selection.select(submission(1), null, { 'treatment-status': value }),
      ),
      value,
    ).toBe(false);
  }

  // Only the one answer that means what the transition is for.
  expect(
    applies(
      selection.select(submission(1), null, {
        'treatment-status': 'post-treatment-stable',
      }),
    ),
  ).toBe(true);
});

test('the gate cannot change any score or any tier', () => {
  const responses = submission(2, { q03: 3 });
  const without = selection.select(responses);
  for (const value of [
    'none',
    'seeking',
    'in-treatment',
    'post-treatment-unstable',
    'post-treatment-stable',
  ]) {
    const withGate = selection.select(responses, null, {
      'treatment-status': value,
    });
    expect(withGate.tierId, value).toBe(without.tierId);
    expect(withGate.scored.domainScores, value).toEqual(
      without.scored.domainScores,
    );
    expect(withGate.scored.overallAverage, value).toBe(
      without.scored.overallAverage,
    );
    expect(withGate.workshopIds, value).toEqual(without.workshopIds);
  }
});

test('the standardized closing is excluded from MILD and present elsewhere', () => {
  const closingApplies = (tierId: string): boolean =>
    content
      .sectionsFor(tierId, () => true)
      .some((s) => s.key === 'standardizedClosing');

  expect(closingApplies('mild')).toBe(false);
  expect(closingApplies('moderate')).toBe(true);
  expect(closingApplies('serious')).toBe(true);
  expect(closingApplies('critical')).toBe(true);
});

test('the urgent-only sections appear only when the parent wrote something', () => {
  const urgentKeys = ['urgentConcern', 'consideringInpatient'];
  const keysFor = (result: ReturnType<typeof selection.select>): string[] =>
    content
      .sectionsFor(result.tierId, (section) =>
        section.when ? evaluate(section.when, result.scored) : true,
      )
      .map((s) => s.key);

  // A SERIOUS plan with no urgent text must not carry them — the live rule says
  // the inpatient section appears in the crisis report only.
  const seriousNoUrgent = keysFor(selection.select(submission(4)));
  for (const key of urgentKeys) {
    expect(seriousNoUrgent, key).not.toContain(key);
  }

  const withUrgent = keysFor(
    selection.select(submission(4), 'he took something an hour ago'),
  );
  for (const key of urgentKeys) {
    expect(withUrgent, key).toContain(key);
  }
});

test('the model is never offered a static section', () => {
  // Static sections are stripped before the schema and prompt are built. This
  // asserts the content shape that makes that possible: a static section has
  // text and no instruction, so there is nothing to tell a model to write.
  const statics = content.sections.sections.filter((s) => s.type === 'static');
  expect(statics.length).toBeGreaterThan(0);
  for (const section of statics) {
    expect(section.text, section.key).toBeTruthy();
    expect(section.instruction, section.key).toBeUndefined();
  }
});
