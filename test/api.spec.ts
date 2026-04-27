import { test, expect } from '@playwright/test';
import * as http from 'http';
import { spawn } from 'child_process';
import { SYSTEM_PROMPT } from '../src/report/prompts/system.prompt';
import {
  ARTICLES_OF_ACTION,
  AUXILIARY_WORKSHOPS,
  DISCUSSION_GROUPS,
} from '../src/report/prompts/resources';

const KEY = 'test-secret';
const MOCK_BASE = 'http://localhost:4001';
const VALID = Array(24).fill(2) as number[];
const SAMPLE = [
  4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3,
];

const post = (request: any, body: unknown, apiKey: string | null = KEY) =>
  request.post('/api/report/generate', {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey !== null ? { 'X-API-Key': apiKey } : {}),
    },
    data: body,
  });

// ─── Health ───────────────────────────────────────────────────────────────────

test('GET /api/health returns 200', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('GET /api/health requires no API key', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

test('missing X-API-Key returns 401', async ({ request }) => {
  const res = await request.post('/api/report/generate', {
    headers: { 'Content-Type': 'application/json' },
    data: { responses: VALID },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(typeof body.error).toBe('string');
});

test('wrong X-API-Key returns 401', async ({ request }) => {
  const res = await post(request, { responses: VALID }, 'wrong-key');
  expect(res.status()).toBe(401);
});

test('correct key with invalid body returns 400 not 401', async ({
  request,
}) => {
  const res = await post(request, { responses: [] });
  expect(res.status()).toBe(400);
});

// ─── Validation ───────────────────────────────────────────────────────────────

const invalidCases: Array<[string, unknown]> = [
  ['missing responses key', {}],
  ['responses is not an array', { responses: 'not-an-array' }],
  ['responses has 23 items', { responses: Array(23).fill(2) }],
  ['responses has 25 items', { responses: Array(25).fill(2) }],
  ['responses contains float', { responses: [...Array(23).fill(2), 2.5] }],
  ['responses contains string', { responses: [...Array(23).fill(2), '3'] }],
  ['responses contains 0', { responses: [...Array(23).fill(2), 0] }],
  ['responses contains 5', { responses: [...Array(23).fill(2), 5] }],
  ['responses is empty array', { responses: [] }],
  ['responses contains null', { responses: [...Array(23).fill(2), null] }],
];

for (const [label, body] of invalidCases) {
  test(`400 when ${label}`, async ({ request }) => {
    const res = await post(request, body);
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
    expect(json.error.length).toBeGreaterThan(0);
  });
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

test('all 5 domain scores are calculated correctly for sample input', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);
  const { domainScores } = await res.json();
  expect(domainScores['Immediate Safety & Urgency']).toBeCloseTo(3.6, 2);
  expect(domainScores['Household Structure']).toBeCloseTo(2.0, 2);
  expect(domainScores['Boundary Consistency']).toBeCloseTo(2.2, 2);
  expect(domainScores['Communication & Conflict']).toBeCloseTo(3.0, 2);
  expect(domainScores['Support & Professional Engagement']).toBeCloseTo(3.0, 2);
});

test('top domain for sample input is Immediate Safety & Urgency', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  const { topDomains } = await res.json();
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
});

test('topDomains always has exactly 3 entries', async ({ request }) => {
  const res = await post(request, { responses: SAMPLE });
  const { topDomains } = await res.json();
  expect(topDomains).toHaveLength(3);
});

test('tie-breaking: all-equal input puts Safety & Urgency first', async ({
  request,
}) => {
  const res = await post(request, { responses: Array(24).fill(2) });
  const { topDomains } = await res.json();
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
});

test('tie-breaking: Communication & Conflict beats Boundary on tie', async ({
  request,
}) => {
  // Build a payload where Communication & Conflict and Boundary Consistency
  // both average exactly 3, and Safety averages 4 (top), so Communication
  // must be #2 ahead of Boundary per TIE_BREAK_ORDER.
  const r = Array(24).fill(2);
  // Safety: Q1,2,10,23,24 → indices 0,1,9,22,23
  for (const i of [0, 1, 9, 22, 23]) r[i] = 4;
  // Communication & Conflict: Q3,5,6,9,13 → 2,4,5,8,12
  for (const i of [2, 4, 5, 8, 12]) r[i] = 3;
  // Boundary Consistency: Q7,11,18,19,22 → 6,10,17,18,21
  for (const i of [6, 10, 17, 18, 21]) r[i] = 3;

  const res = await post(request, { responses: r });
  const { domainScores, topDomains } = await res.json();
  expect(domainScores['Communication & Conflict']).toBeCloseTo(3.0, 2);
  expect(domainScores['Boundary Consistency']).toBeCloseTo(3.0, 2);
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
  expect(topDomains[1]).toBe('Communication & Conflict');
  expect(topDomains[2]).toBe('Boundary Consistency');
});

// ─── Response Shape ───────────────────────────────────────────────────────────

const DOMAIN_NAMES = [
  'Immediate Safety & Urgency',
  'Household Structure',
  'Boundary Consistency',
  'Communication & Conflict',
  'Support & Professional Engagement',
];

const REPORT_KEYS = [
  'headlineSummary',
  'topImmediatePriorities',
  'keyPriorities',
  'whatToAvoid',
  'first72Hours',
  'days4to7',
  'encouragement',
];

test('success response has correct shape', async ({ request }) => {
  const res = await post(request, { responses: VALID });
  expect(res.status()).toBe(200);

  const body = await res.json();

  expect(body.success).toBe(true);

  expect(Object.keys(body.domainScores)).toHaveLength(5);
  for (const name of DOMAIN_NAMES) {
    expect(body.domainScores[name]).toBeDefined();
    expect(body.domainScores[name]).toBeGreaterThanOrEqual(1);
    expect(body.domainScores[name]).toBeLessThanOrEqual(4);
  }

  expect(body.topDomains).toHaveLength(3);
  for (const d of body.topDomains) {
    expect(DOMAIN_NAMES).toContain(d);
  }

  expect(Object.keys(body.report)).toHaveLength(7);
  for (const key of REPORT_KEYS) {
    expect(typeof body.report[key]).toBe('string');
    expect(body.report[key].length).toBeGreaterThan(0);
  }
});

// ─── Outgoing Prompt ──────────────────────────────────────────────────────────

test('outgoing OpenAI request uses verbatim SYSTEM_PROMPT and includes scores + top 3', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  expect(captured).not.toBeNull();
  expect(captured.headers['authorization']).toBe('Bearer mock-key');

  const { body } = captured;
  expect(body.model).toBe('gpt-4o-mini');

  expect(Array.isArray(body.messages)).toBe(true);
  expect(body.messages).toHaveLength(2);
  expect(body.messages[0].role).toBe('system');
  expect(body.messages[0].content).toBe(SYSTEM_PROMPT);
  expect(body.messages[1].role).toBe('user');

  const userContent: string = body.messages[1].content;
  // All 5 domain names + numeric values rounded to 2dp must be present
  expect(userContent).toContain('Immediate Safety & Urgency: 3.60');
  expect(userContent).toContain('Household Structure: 2.00');
  expect(userContent).toContain('Boundary Consistency: 2.20');
  expect(userContent).toContain('Communication & Conflict: 3.00');
  expect(userContent).toContain('Support & Professional Engagement: 3.00');
  // Top 3 list must appear, with Safety first
  expect(userContent).toContain('Top 3 Priority Domains:');
  expect(userContent).toMatch(
    /Top 3 Priority Domains:\s*Immediate Safety & Urgency,/,
  );
  // Per-question context: SAMPLE has Q1=4, Q3=4, Q9=4, Q17=4, Q23=4 as strong concerns
  expect(userContent).toContain('Strong concerns (scored 4');
  expect(userContent).toContain(
    'How certain are you that your child has used drugs',
  );
  expect(userContent).toContain('mood swings, withdrawal, or aggressive');
  // New 7-section header list
  expect(userContent).toContain('TOP 3 IMMEDIATE PRIORITIES');
  expect(userContent).toContain('FIRST 72 HOURS PLAN');
  expect(userContent).toContain('DAYS 4 TO 7 CONTINUATION');
});

// ─── System Prompt Content (Matthew refinements) ─────────────────────────────

test('SYSTEM_PROMPT reflects Matthew refinements', () => {
  // 1. Headline intuition + expanded signals
  expect(SYSTEM_PROMPT).toMatch(/parental intuition/i);
  expect(SYSTEM_PROMPT).toMatch(/declining grades/i);
  expect(SYSTEM_PROMPT).toMatch(/strained relationships/i);

  // 2. Priority order: regulation → alignment → support → THEN conversation
  const regIdx = SYSTEM_PROMPT.indexOf('PARENT EMOTIONAL REGULATION');
  const alignIdx = SYSTEM_PROMPT.indexOf('CO-PARENT / CAREGIVER ALIGNMENT');
  const supportIdx = SYSTEM_PROMPT.indexOf('BUILD THE SUPPORT GROUP');
  expect(regIdx).toBeGreaterThan(-1);
  expect(alignIdx).toBeGreaterThan(regIdx);
  expect(supportIdx).toBeGreaterThan(alignIdx);
  expect(SYSTEM_PROMPT).toMatch(
    /conversation with the child comes AFTER these three/i,
  );

  // 3. Soft search framing (not "don't search")
  expect(SYSTEM_PROMPT).toMatch(/soft search/i);
  expect(SYSTEM_PROMPT).toMatch(/without the child's knowledge/i);
  expect(SYSTEM_PROMPT).toMatch(/room is left exactly as it was found/i);
  expect(SYSTEM_PROMPT).toMatch(/document it, then remove it/i);
  expect(SYSTEM_PROMPT).toMatch(
    /boundary, not a punishment|boundary, not as punishment|clear boundary, not a punishment/i,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /BEFORE the initial conversation|before the initial conversation/i,
  );

  // 4. 72-hour plan sequencing
  const d1 = SYSTEM_PROMPT.indexOf(
    'DAY 1 — EMOTIONAL REGULATION + CO-PARENT ALIGNMENT',
  );
  const d2 = SYSTEM_PROMPT.indexOf(
    'DAY 2 — BUILD THE SUPPORT GROUP + GATHER INFORMATION',
  );
  const d3 = SYSTEM_PROMPT.indexOf('DAY 3 — PREPARE FOR THE CONVERSATION');
  expect(d1).toBeGreaterThan(-1);
  expect(d2).toBeGreaterThan(d1);
  expect(d3).toBeGreaterThan(d2);

  // Natural conversation tone guidance present
  expect(SYSTEM_PROMPT).toMatch(/not scripted/i);
  expect(SYSTEM_PROMPT).toMatch(/parent \+ child vs the problem/i);

  // 5. Articles of Action referenced by TITLE only — no "Chapter N" citations.
  expect(SYSTEM_PROMPT).toMatch(/Articles of Action/);
  expect(SYSTEM_PROMPT).toMatch(/by title only/i);
  expect(SYSTEM_PROMPT).not.toMatch(/Chapter\s+\d+/);
  expect(SYSTEM_PROMPT).not.toMatch(/Articles of Action,?\s*Chapter/i);

  // 6. ASAP Discussion Groups as primary support mechanism
  expect(SYSTEM_PROMPT).toMatch(/ASAP Discussion Group/);
  expect(SYSTEM_PROMPT).toMatch(/PRIMARY support mechanism/i);
  expect(SYSTEM_PROMPT).toMatch(/JOIN AND ACTIVELY POST/);

  // 7. Auxiliary workshops referenced by exact title
  expect(SYSTEM_PROMPT).toMatch(/Auxiliary Workshop/);
  expect(SYSTEM_PROMPT).toMatch(/exact title/i);
});

// ─── Tone refinement: AI-coaching filler banned in MILD + overall ─────────────

test('SYSTEM_PROMPT bans AI-coaching filler phrases by name', () => {
  // The prompt must explicitly list these as banned so the model stops using them.
  expect(SYSTEM_PROMPT).toMatch(/take a moment/i);
  expect(SYSTEM_PROMPT).toMatch(/this is a good time/i);
  expect(SYSTEM_PROMPT).toMatch(/it's important to/i);
  expect(SYSTEM_PROMPT).toMatch(/breathe deeply|take a deep breath/i);
  expect(SYSTEM_PROMPT).toMatch(/be mindful of|allow yourself to/i);

  // The ban must be framed as a rule, not as acceptable language.
  expect(SYSTEM_PROMPT).toMatch(/AI-coaching filler|polite AI|self-help book/i);
});

test('SYSTEM_PROMPT includes the "frustrated, angry, and unsure" direct-tone example', () => {
  // Matthew's founder-level example — baked in so the model has a concrete template.
  expect(SYSTEM_PROMPT).toMatch(/frustrated, angry, and unsure/i);
  expect(SYSTEM_PROMPT).toMatch(/can't be in the driver's seat|can't be in control/i);
  expect(SYSTEM_PROMPT).toMatch(/step away.{0,40}come back steady/i);
});

test('SYSTEM_PROMPT MILD block demands direct emotional honesty, not polished coaching', () => {
  const mildIdx = SYSTEM_PROMPT.indexOf('MILD — mostly 1s and 2s');
  expect(mildIdx).toBeGreaterThan(-1);
  const moderateIdx = SYSTEM_PROMPT.indexOf('MODERATE — a mix');
  expect(moderateIdx).toBeGreaterThan(mildIdx);

  const mildBlock = SYSTEM_PROMPT.slice(mildIdx, moderateIdx);
  // Must explicitly warn against the wellness-coach drift.
  expect(mildBlock).toMatch(/polished|polite|sanitized|wellness-coach/i);
  // Must give the model permission to name frustration / uncertainty.
  expect(mildBlock).toMatch(/frustration|uncertainty|doubt/i);
  expect(mildBlock).toMatch(/second-guess/i);
  // Must keep the "not a crisis" guardrail.
  expect(mildBlock).toMatch(/NOT urgent|not a crisis|NOT catastrophizing/i);
});

test('SYSTEM_PROMPT has explicit HONESTY OVER POLISH rule', () => {
  expect(SYSTEM_PROMPT).toMatch(/HONESTY OVER POLISH/);
  expect(SYSTEM_PROMPT).toMatch(/frustration, anger, fear, exhaustion/i);
});

// ─── Tone refinement round 2: decisive + normalize ───────────────────────────

test('SYSTEM_PROMPT prefers decisive language over suggestive hedging', () => {
  expect(SYSTEM_PROMPT).toMatch(/DECISIVE LANGUAGE/);
  // The "worth taking seriously" → "need to be taken seriously" rewrite.
  expect(SYSTEM_PROMPT).toMatch(/need to be taken seriously/i);

  // The phrase "worth taking seriously" is allowed INSIDE the DECISIVE
  // LANGUAGE rule (it's the hedge being banned + the BAD example), but
  // must not appear anywhere else as instructional copy.
  const ruleStart = SYSTEM_PROMPT.indexOf('DECISIVE LANGUAGE');
  const ruleEnd = SYSTEM_PROMPT.indexOf('NORMALIZE AFTER NAMING');
  expect(ruleStart).toBeGreaterThan(-1);
  expect(ruleEnd).toBeGreaterThan(ruleStart);
  const before = SYSTEM_PROMPT.slice(0, ruleStart);
  const after = SYSTEM_PROMPT.slice(ruleEnd);
  expect(before).not.toMatch(/worth taking seriously/i);
  expect(after).not.toMatch(/worth taking seriously/i);
});

test('SYSTEM_PROMPT requires normalize-after-naming for feelings', () => {
  expect(SYSTEM_PROMPT).toMatch(/NORMALIZE AFTER NAMING/);
  expect(SYSTEM_PROMPT).toMatch(/name → normalize → direct it/i);
  // Founder's exact example, baked in as a template.
  expect(SYSTEM_PROMPT).toMatch(
    /confusion and frustration — and that's normal/,
  );
});

test('PARENT EMOTIONAL REGULATION bullet enforces normalize step', () => {
  const idx = SYSTEM_PROMPT.indexOf('PARENT EMOTIONAL REGULATION');
  const next = SYSTEM_PROMPT.indexOf(
    'CO-PARENT / CAREGIVER ALIGNMENT',
    idx,
  );
  expect(idx).toBeGreaterThan(-1);
  expect(next).toBeGreaterThan(idx);
  const bullet = SYSTEM_PROMPT.slice(idx, next);
  expect(bullet).toMatch(/normalize/i);
  expect(bullet).toMatch(/that's normal/i);
  expect(bullet).toMatch(/decisive/i);
});

// ─── ASAP Resource Directory (16 / 6 / 20 lists) ──────────────────────────────

test('resource directory module exposes the correct counts', () => {
  expect(ARTICLES_OF_ACTION).toHaveLength(16);
  expect(DISCUSSION_GROUPS).toHaveLength(6);
  expect(AUXILIARY_WORKSHOPS).toHaveLength(20);
});

test('resource titles are unique', () => {
  expect(new Set(ARTICLES_OF_ACTION).size).toBe(ARTICLES_OF_ACTION.length);
  expect(new Set(DISCUSSION_GROUPS).size).toBe(DISCUSSION_GROUPS.length);
  expect(new Set(AUXILIARY_WORKSHOPS.map((w) => w.title)).size).toBe(
    AUXILIARY_WORKSHOPS.length,
  );
});

test('outgoing user prompt ships every Article / Workshop / Discussion Group verbatim', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // Directory header
  expect(userContent).toContain('ASAP RESOURCE DIRECTORY');
  expect(userContent).toContain('Articles of Action (16 total');
  expect(userContent).toContain('ASAP Discussion Groups (6 total');
  expect(userContent).toContain('Auxiliary Workshops (20 total');

  // Every article title appears verbatim
  for (const title of ARTICLES_OF_ACTION) {
    expect(userContent).toContain(title);
  }
  // Every discussion group appears verbatim
  for (const group of DISCUSSION_GROUPS) {
    expect(userContent).toContain(group);
  }
  // Every workshop title + summary appears verbatim
  for (const w of AUXILIARY_WORKSHOPS) {
    expect(userContent).toContain(w.title);
    expect(userContent).toContain(w.summary);
  }

  // Reminder requires exact-title usage and bans chapter numbers
  expect(userContent).toMatch(/cited by full exact title/i);
  expect(userContent).toMatch(/never by chapter number/i);
  expect(userContent).toMatch(/PRIMARY support mechanism/i);
});

test('outgoing user prompt carries the new sequencing + resource order', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // Resource order reminder includes Discussion Groups as a primary step
  expect(userContent).toMatch(/ASAP Discussion Groups/);
  expect(userContent).toMatch(/primary support mechanism/i);
  expect(userContent).toMatch(/soft search/i);
  expect(userContent).toMatch(/never by chapter number/i);

  // Ordering sequence for the 72-hour plan appears in the reminder
  expect(userContent).toMatch(
    /Day 1 = emotional regulation \+ co-parent alignment/i,
  );
  expect(userContent).toMatch(
    /Day 2 = build support group \+ gather information/i,
  );
  expect(userContent).toMatch(
    /Day 3 = prepare for the first real conversation/i,
  );

  // The user prompt must not cite any "Chapter N" or "Articles of Action, Chapter ..." reference
  expect(userContent).not.toMatch(/Chapter\s+\d+/);
  expect(userContent).not.toMatch(/Articles of Action,?\s*Chapter/i);
});

// ─── Claude Failure ───────────────────────────────────────────────────────────

test('returns 500 when OpenAI API fails', async () => {
  const errorServer = http.createServer((_req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'upstream error' } }));
  });

  await new Promise<void>((r) => errorServer.listen(4002, r));

  const failApp = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT: '3002',
        API_SECRET_KEY: 'test-secret',
        OPENAI_API_KEY: 'mock-key',
        OPENAI_API_URL: 'http://localhost:4002',
      },
      stdio: 'pipe',
    },
  );

  try {
    await new Promise<void>((resolve, reject) => {
      failApp.stdout?.on('data', (chunk: Buffer) => {
        if (
          chunk.toString().includes('Nest application successfully started')
        ) {
          resolve();
        }
      });
      failApp.on('error', reject);
      setTimeout(() => reject(new Error('Fail app did not start')), 20000);
    });

    const res = await fetch('http://localhost:3002/api/report/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-secret',
      },
      body: JSON.stringify({ responses: VALID }),
    });

    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: 'Report generation failed. Please try again.',
    });
  } finally {
    failApp.kill();
    await new Promise<void>((r) => errorServer.close(() => r()));
  }
});
