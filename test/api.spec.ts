import { test, expect } from '@playwright/test';
import * as http from 'http';
import { spawn } from 'child_process';

const KEY = 'test-secret';
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

test('domain scores are calculated correctly for sample input', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);
  const { domainScores } = await res.json();
  expect(domainScores['Immediate Safety & Urgency']).toBeCloseTo(3.6, 1);
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
  'keyPriorities',
  'whatToAvoid',
  'next7Days',
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

  expect(Object.keys(body.report)).toHaveLength(5);
  for (const key of REPORT_KEYS) {
    expect(typeof body.report[key]).toBe('string');
    expect(body.report[key].length).toBeGreaterThan(0);
  }
});

// ─── Claude Failure ───────────────────────────────────────────────────────────

test('returns 500 when Claude API fails', async () => {
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
        ANTHROPIC_API_KEY: 'mock-key',
        ANTHROPIC_API_URL: 'http://localhost:4002',
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