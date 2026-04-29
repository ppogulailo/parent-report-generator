import { test, expect } from '@playwright/test';
import { validateReportResources } from '../src/report/validation/resource-validator';

const KEY = 'test-secret';
const MOCK_BASE = 'http://localhost:4001';

const post = (request: any, body: unknown) =>
  request.post('/api/report/generate', {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    data: body,
  });

const getLastUserPrompt = async (): Promise<string> => {
  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  return captured.body.messages[1].content as string;
};

// ─── Severity classification ─────────────────────────────────────────────────

const SEVERITY_CASES: Array<{
  label: string;
  responses: number[];
  expected: 'MILD' | 'MODERATE' | 'SERIOUS';
}> = [
  {
    label: 'all 1s (mild)',
    responses: Array(24).fill(1),
    expected: 'MILD',
  },
  {
    label: 'all 2s (moderate baseline)',
    responses: Array(24).fill(2),
    expected: 'MODERATE',
  },
  {
    label: 'mostly 2s with a pair of 3s (moderate)',
    responses: [
      2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2,
    ],
    expected: 'MODERATE',
  },
  {
    label: 'all 4s (serious)',
    responses: Array(24).fill(4),
    expected: 'SERIOUS',
  },
  {
    label: 'high safety-domain answers (serious)',
    // Drives Immediate Safety & Urgency (indices 0,1,9,22,23) to 4.0
    responses: (() => {
      const r = Array(24).fill(2);
      for (const i of [0, 1, 9, 22, 23]) r[i] = 4;
      return r;
    })(),
    expected: 'SERIOUS',
  },
];

for (const { label, responses, expected } of SEVERITY_CASES) {
  test(`severity classification: ${label} → ${expected}`, async ({
    request,
  }) => {
    const res = await post(request, { responses });
    expect(res.status()).toBe(200);
    const userPrompt = await getLastUserPrompt();
    expect(userPrompt).toContain(`SEVERITY LEVEL: ${expected}`);
  });
}

// ─── Report always comes back non-empty for valid inputs ─────────────────────

const SECTION_KEYS = [
  'headlineSummary',
  'topImmediatePriorities',
  'keyPriorities',
  'whatToAvoid',
  'first72Hours',
  'days4to7',
  'encouragement',
];

const EDGE_INPUTS: Array<[string, number[]]> = [
  ['all 1s', Array(24).fill(1)],
  ['all 2s', Array(24).fill(2)],
  ['all 3s', Array(24).fill(3)],
  ['all 4s', Array(24).fill(4)],
  [
    'alternating 1-4',
    Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 1 : 4)),
  ],
  ['ascending pattern', Array.from({ length: 24 }, (_, i) => (i % 4) + 1)],
];

for (const [label, responses] of EDGE_INPUTS) {
  test(`stability: ${label} produces a non-empty 7-section report`, async ({
    request,
  }) => {
    const res = await post(request, { responses });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    for (const key of SECTION_KEYS) {
      expect(typeof body.report[key]).toBe('string');
      expect(body.report[key].length).toBeGreaterThan(0);
    }
    // Top 3 list and 5 domain scores always present
    expect(body.topDomains).toHaveLength(3);
    expect(Object.keys(body.domainScores)).toHaveLength(5);
  });
}

// ─── Resource-reference validator ────────────────────────────────────────────

test('resource validator accepts the mock report (canonical or plain prose)', () => {
  const cleanReport = {
    headlineSummary: 'A calm, direction-giving overview.',
    topImmediatePriorities:
      '- Parent regulation\n- Co-parent alignment\n- Support group',
    keyPriorities: 'Focus on Immediate Safety & Urgency first.',
    whatToAvoid: '- Ultimatums without follow-through',
    first72Hours: 'Day 1: regulation. Day 2: support. Day 3: conversation.',
    days4to7: 'Continue daily check-ins.',
    encouragement: 'You are not alone.',
  };
  expect(validateReportResources(cleanReport)).toEqual([]);
});

test('resource validator flags invented Article titles', () => {
  const report = {
    headlineSummary: '',
    topImmediatePriorities: '',
    keyPriorities:
      'Articles of Action: The Complete Guide To Fixing Teens (invented title).',
    whatToAvoid: '',
    first72Hours: '',
    days4to7: '',
    encouragement: '',
  };
  const warnings = validateReportResources(report);
  expect(warnings.length).toBeGreaterThan(0);
  expect(warnings.some((w) => w.kind === 'article')).toBe(true);
});

test('resource validator accepts a real Article title cited in-line', () => {
  const report = {
    headlineSummary: '',
    topImmediatePriorities: '',
    keyPriorities:
      'Article of Action: Drug Testing: A Crucial Step in Intervention',
    whatToAvoid: '',
    first72Hours: '',
    days4to7: '',
    encouragement: '',
  };
  const warnings = validateReportResources(report).filter(
    (w) => w.kind === 'article',
  );
  expect(warnings).toEqual([]);
});

test('resource validator flags chapter-number citations', () => {
  const report = {
    headlineSummary: '',
    topImmediatePriorities: '',
    keyPriorities: 'See Articles of Action, Chapter 4.',
    whatToAvoid: '',
    first72Hours: '',
    days4to7: '',
    encouragement: '',
  };
  const warnings = validateReportResources(report);
  expect(warnings.some((w) => w.kind === 'chapter-citation')).toBe(true);
});

test('resource validator flags invented Discussion Group names', () => {
  const report = {
    headlineSummary: '',
    topImmediatePriorities: '',
    keyPriorities: 'Join Discussion Group: Late Night Vibes (not a real group)',
    whatToAvoid: '',
    first72Hours: '',
    days4to7: '',
    encouragement: '',
  };
  const warnings = validateReportResources(report);
  expect(warnings.some((w) => w.kind === 'discussion-group')).toBe(true);
});

test('resource validator accepts a real Discussion Group name', () => {
  const report = {
    headlineSummary: '',
    topImmediatePriorities: '',
    keyPriorities: 'Join the ASAP Discussion Group: Effective Communication',
    whatToAvoid: '',
    first72Hours: '',
    days4to7: '',
    encouragement: '',
  };
  const warnings = validateReportResources(report).filter(
    (w) => w.kind === 'discussion-group',
  );
  expect(warnings).toEqual([]);
});
