import { test, expect } from '@playwright/test';
import { SR_SYSTEM_PROMPT } from '../src/report/sustaining-recovery/sr-system.prompt';
import { SR_SYSTEM_PROMPT_ES } from '../src/report/sustaining-recovery/sr-system.prompt.es';
import {
  SR_DOMAIN_MAP,
  SR_TIE_BREAK_ORDER,
} from '../src/report/sustaining-recovery/sr-domain.map';

const KEY = 'test-secret';
const MOCK_BASE = 'http://localhost:4001';
const ROUTE = '/api/report/sustaining-recovery/generate';

const VALID = Array(20).fill(2) as number[];
// Relapse Risk & Safety [0-3] all 4 → 4.0 (top); Routine [8-11] all 3 → 3.0;
// Ongoing [16-19] all 3 → 3.0 (Routine beats Ongoing on tie-break).
const SAMPLE = [
  4, 4, 4, 4, 2, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 3, 3, 3, 3,
];

const SR_DOMAIN_NAMES = [
  'Relapse Risk & Safety',
  'Home Environment & Triggers',
  'Routine & Structure',
  'Communication & Trust',
  'Ongoing Support & Treatment Continuity',
];

const post = (request: any, body: unknown, apiKey: string | null = KEY) =>
  request.post(ROUTE, {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey !== null ? { 'X-API-Key': apiKey } : {}),
    },
    data: body,
  });

// ─── Sanity on the draft domain map ───────────────────────────────────────────

test('SR domain map has 5 domains covering all 20 questions exactly once', () => {
  expect(Object.keys(SR_DOMAIN_MAP)).toHaveLength(5);
  const indices = Object.values(SR_DOMAIN_MAP).flat().sort((a, b) => a - b);
  expect(indices).toEqual(Array.from({ length: 20 }, (_, i) => i));
  // Tie-break order lists every domain.
  expect([...SR_TIE_BREAK_ORDER].sort()).toEqual(
    [...Object.keys(SR_DOMAIN_MAP)].sort(),
  );
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

test('SR: missing X-API-Key returns 401', async ({ request }) => {
  const res = await post(request, { responses: VALID }, null);
  expect(res.status()).toBe(401);
});

// ─── Validation (20 ints, 1–4) ────────────────────────────────────────────────

const invalidCases: Array<[string, unknown]> = [
  ['missing responses key', {}],
  ['responses has 19 items', { responses: Array(19).fill(2) }],
  ['responses has 21 items', { responses: Array(21).fill(2) }],
  ['responses contains float', { responses: [...Array(19).fill(2), 2.5] }],
  ['responses contains 0', { responses: [...Array(19).fill(2), 0] }],
  ['responses contains 5', { responses: [...Array(19).fill(2), 5] }],
];

for (const [label, body] of invalidCases) {
  test(`SR: 400 when ${label}`, async ({ request }) => {
    const res = await post(request, body);
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
  });
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

test('SR: domain scores + top 3 for sample input', async ({ request }) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);
  const { domainScores, topDomains } = await res.json();
  expect(domainScores['Relapse Risk & Safety']).toBeCloseTo(4.0, 2);
  expect(domainScores['Home Environment & Triggers']).toBeCloseTo(2.0, 2);
  expect(domainScores['Routine & Structure']).toBeCloseTo(3.0, 2);
  expect(domainScores['Communication & Trust']).toBeCloseTo(2.0, 2);
  expect(domainScores['Ongoing Support & Treatment Continuity']).toBeCloseTo(
    3.0,
    2,
  );
  expect(topDomains).toEqual([
    'Relapse Risk & Safety',
    'Routine & Structure',
    'Ongoing Support & Treatment Continuity',
  ]);
});

test('SR: all-equal input puts Relapse Risk & Safety first via tie-break', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID });
  const { topDomains } = await res.json();
  expect(topDomains[0]).toBe('Relapse Risk & Safety');
  expect(topDomains).toHaveLength(3);
});

// ─── Response shape ────────────────────────────────────────────────────────────

const SR_KEYS_ALWAYS_NON_EMPTY = [
  'welcomeHomeSummary',
  'topImmediatePriorities',
  'rebuildingStructure',
  'relapseWarningSigns',
  'whatToAvoid',
  'firstTwoWeeks',
  'ongoingSupport',
];

test('SR: success response has correct shape', async ({ request }) => {
  const res = await post(request, { responses: VALID });
  expect(res.status()).toBe(200);
  const body = await res.json();

  expect(body.success).toBe(true);
  expect(body.reportType).toBe('sustaining-recovery');
  expect(body.draft).toBe(true);

  expect(Object.keys(body.domainScores)).toHaveLength(5);
  for (const name of SR_DOMAIN_NAMES) {
    expect(body.domainScores[name]).toBeGreaterThanOrEqual(1);
    expect(body.domainScores[name]).toBeLessThanOrEqual(4);
  }
  expect(body.topDomains).toHaveLength(3);

  expect(Object.keys(body.report)).toHaveLength(8);
  expect(typeof body.report.urgentConcern).toBe('string'); // empty without crisis
  for (const k of SR_KEYS_ALWAYS_NON_EMPTY) {
    expect(typeof body.report[k]).toBe('string');
    expect(body.report[k].length).toBeGreaterThan(0);
  }
});

// ─── Outgoing prompt ────────────────────────────────────────────────────────────

test('SR: outgoing request uses verbatim SR_SYSTEM_PROMPT and post-treatment framing', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const { body } = captured;
  expect(body.messages[0].content).toBe(SR_SYSTEM_PROMPT);

  const userContent: string = body.messages[1].content;
  expect(userContent).toContain('SUSTAINING RECOVERY Parent Action Plan');
  expect(userContent).toContain('Relapse Risk & Safety: 4.00');
  // SR section headers present in the instruction
  expect(userContent).toContain('WELCOME HOME SUMMARY');
  expect(userContent).toContain('RELAPSE WARNING SIGNS');
  expect(userContent).toContain('FIRST TWO WEEKS PLAN');
  // Recovery-stage classification line present
  expect(userContent).toMatch(/RECOVERY STAGE: (STABLE|WATCHFUL|HIGH RISK)/);
  // Shared resource directory + professional-help sequence carried over
  expect(userContent).toContain('ASAP RESOURCE DIRECTORY');
  expect(userContent).toContain(
    'For guidance, consider posting questions in the Sustaining Recovery discussion group.',
  );
});

test('SR: Spanish request uses the ES system prompt', async ({ request }) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);
  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  expect(captured.body.messages[0].content).toBe(SR_SYSTEM_PROMPT_ES);
});

// ─── Crisis escalation ──────────────────────────────────────────────────────────

test('SR: crisis field escalates to HIGH RISK and adds urgentConcern section', async ({
  request,
}) => {
  const res = await post(request, {
    responses: VALID,
    crisis: 'Found an unknown substance in their room two days after coming home.',
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.report.urgentConcern.length).toBeGreaterThan(0);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain('RECOVERY STAGE: HIGH RISK');
  expect(userContent).toContain('URGENT CONCERN — parent flagged this');
});
