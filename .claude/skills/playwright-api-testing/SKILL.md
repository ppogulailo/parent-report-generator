---
name: playwright-api-testing
description: Playwright API testing patterns for this project. Use when writing or modifying tests in the test/ directory, setting up globalSetup/globalTeardown, mocking external services, asserting response shapes, or running the test suite. Covers NestJS app bootstrap in tests, mock server setup, request fixture usage, and the full assertion pattern for every endpoint in this project.
---

# Playwright API Testing — Project Patterns

All API tests live in `test/api.spec.ts`. Tests use Playwright's `request` fixture — no browser, no page. The NestJS app and a mock Anthropic server are started in `globalSetup` and torn down in `globalTeardown`. Never call the real Anthropic API in tests.

---

## File Structure

```
test/
├── global-setup.ts       # starts mock server + NestJS app
├── global-teardown.ts    # kills both
└── api.spec.ts           # all tests
playwright.config.ts
```

---

## `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  globalSetup:    './test/global-setup.ts',
  globalTeardown: './test/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3001',
  },
  timeout: 30000,
});
```

---

## `global-setup.ts`

Starts a mock Anthropic server first, then starts the NestJS app pointing at it. The app must be fully started before any test runs.

```ts
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

const MOCK_PORT = 4001;
const APP_PORT  = 3001;

// Mock response body — contains all 5 section headers so parseSections is exercised
const MOCK_RESPONSE_BODY = JSON.stringify({
  content: [{
    type: 'text',
    text: [
      'HEADLINE SUMMARY',
      'You are taking a courageous step by addressing this situation directly.',
      '',
      'KEY PRIORITIES',
      'Immediate Safety & Urgency is the most pressing concern right now.',
      '',
      'WHAT TO AVOID',
      'Avoid issuing ultimatums without a clear follow-through plan.',
      '',
      'NEXT 7 DAYS ACTION PLAN',
      'Days 1–2: Have a calm, private conversation with your child.',
      '',
      'ENCOURAGEMENT & DIRECTION',
      'You are not alone. Many parents have navigated this successfully.',
    ].join('\n'),
  }],
});

export default async function globalSetup() {
  // 1. Start mock Anthropic server
  const mockServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(MOCK_RESPONSE_BODY);
  });

  await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, resolve));
  (global as any).__MOCK_SERVER__ = mockServer;

  // 2. Start NestJS app
  const appProcess: ChildProcess = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT:              String(APP_PORT),
        API_SECRET_KEY:    'test-secret',
        ANTHROPIC_API_KEY: 'mock-key',
        ANTHROPIC_API_URL: `http://localhost:${MOCK_PORT}`,
      },
      stdio: 'pipe',
    },
  );

  await new Promise<void>((resolve, reject) => {
    appProcess.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Nest application successfully started')) resolve();
    });
    appProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[app stderr]', chunk.toString());
    });
    appProcess.on('error', reject);
    setTimeout(() => reject(new Error('App did not start within 15s')), 15000);
  });

  (global as any).__APP_PROCESS__ = appProcess;
}
```

---

## `global-teardown.ts`

```ts
export default async function globalTeardown() {
  (global as any).__APP_PROCESS__?.kill();
  await new Promise<void>((resolve) =>
    (global as any).__MOCK_SERVER__?.close(resolve),
  );
}
```

---

## `api.spec.ts` — Full Test Suite

```ts
import { test, expect } from '@playwright/test';
import * as http from 'http';
import { spawn } from 'child_process';

const KEY   = 'test-secret';
const VALID  = Array(24).fill(2) as number[];
const SAMPLE = [4,3,4,2,3,2,3,3,4,4,2,3,2,2,3,2,4,2,2,2,2,2,4,3]; // from SPEC §14

const post = (request: any, body: unknown, apiKey = KEY) =>
  request.post('/api/report/generate', {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
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

test('correct key with invalid body returns 400 not 401', async ({ request }) => {
  const res = await post(request, { responses: [] });
  expect(res.status()).toBe(400); // guard passes, DTO fails
});

// ─── Validation ───────────────────────────────────────────────────────────────

const invalidCases: Array<[string, unknown]> = [
  ['missing responses key',       {}],
  ['responses is not an array',   { responses: 'not-an-array' }],
  ['responses has 23 items',      { responses: Array(23).fill(2) }],
  ['responses has 25 items',      { responses: Array(25).fill(2) }],
  ['responses contains float',    { responses: [...Array(23).fill(2), 2.5] }],
  ['responses contains string',   { responses: [...Array(23).fill(2), '3'] }],
  ['responses contains 0',        { responses: [...Array(23).fill(2), 0] }],
  ['responses contains 5',        { responses: [...Array(23).fill(2), 5] }],
  ['responses is empty array',    { responses: [] }],
  ['responses contains null',     { responses: [...Array(23).fill(2), null] }],
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

test('domain scores are calculated correctly for sample input', async ({ request }) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);
  const { domainScores } = await res.json();
  expect(domainScores['Immediate Safety & Urgency']).toBeCloseTo(3.6, 1);
});

test('top domain for sample input is Immediate Safety & Urgency', async ({ request }) => {
  const res = await post(request, { responses: SAMPLE });
  const { topDomains } = await res.json();
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
});

test('topDomains always has exactly 3 entries', async ({ request }) => {
  const res = await post(request, { responses: SAMPLE });
  const { topDomains } = await res.json();
  expect(topDomains).toHaveLength(3);
});

test('tie-breaking: all-equal input puts Safety & Urgency first', async ({ request }) => {
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

  // domainScores — exactly 5 keys, all numbers in range
  expect(Object.keys(body.domainScores)).toHaveLength(5);
  for (const name of DOMAIN_NAMES) {
    expect(body.domainScores[name]).toBeDefined();
    expect(body.domainScores[name]).toBeGreaterThanOrEqual(1);
    expect(body.domainScores[name]).toBeLessThanOrEqual(4);
  }

  // topDomains — 3 strings, all valid domain names
  expect(body.topDomains).toHaveLength(3);
  for (const d of body.topDomains) {
    expect(DOMAIN_NAMES).toContain(d);
  }

  // report — 5 non-empty strings
  expect(Object.keys(body.report)).toHaveLength(5);
  for (const key of REPORT_KEYS) {
    expect(typeof body.report[key]).toBe('string');
    expect(body.report[key].length).toBeGreaterThan(0);
  }
});

// ─── Claude Failure ───────────────────────────────────────────────────────────

test('returns 500 when Claude API fails', async () => {
  // Spin a one-off error mock + app instance for this test
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
        PORT:              '3002',
        API_SECRET_KEY:    'test-secret',
        ANTHROPIC_API_KEY: 'mock-key',
        ANTHROPIC_API_URL: 'http://localhost:4002',
      },
      stdio: 'pipe',
    },
  );

  await new Promise<void>((resolve, reject) => {
    failApp.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Nest application successfully started')) resolve();
    });
    failApp.on('error', reject);
    setTimeout(() => reject(new Error('Fail app did not start')), 15000);
  });

  const res = await fetch('http://localhost:3002/api/report/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-secret' },
    body: JSON.stringify({ responses: VALID }),
  });

  const body = await res.json();
  expect(res.status).toBe(500);
  expect(body).toEqual({
    success: false,
    error: 'Report generation failed. Please try again.',
  });

  failApp.kill();
  await new Promise<void>((r) => errorServer.close(r));
});
```

---

## Key Rules

**Use `request` fixture, not `page`** — these are pure API tests. Never import `page` or use browser APIs.

```ts
// ✅ Correct
test('...', async ({ request }) => {
  const res = await request.post('/api/report/generate', { ... });
});

// ❌ Wrong — page is for browser tests
test('...', async ({ page }) => {
  await page.goto('/api/report/generate');
});
```

**Never call the real Anthropic API** — all tests run against the mock server started in `globalSetup`. If `ANTHROPIC_API_URL` is not set in the spawned app's env, the test is broken.

**Don't start the server inside a test** — only `globalSetup` starts the main app. Individual tests that need a different server config (like the 500 failure test) spin their own isolated instance and tear it down within the test.

**Always assert both status code and body shape** — a 500 that returns HTML instead of JSON is a different failure than a 500 that returns `{ success: false, error: '...' }`.

```ts
// ✅ Assert both
expect(res.status()).toBe(400);
const body = await res.json();
expect(body.success).toBe(false);
expect(typeof body.error).toBe('string');

// ❌ Status only — doesn't verify the response shape contract
expect(res.status()).toBe(400);
```

**Call `res.json()` once and store it** — calling it twice throws because the response stream is consumed.

```ts
// ✅ Correct
const body = await res.json();
expect(body.success).toBe(true);
expect(body.topDomains).toHaveLength(3);

// ❌ Throws on second call
expect((await res.json()).success).toBe(true);
expect((await res.json()).topDomains).toHaveLength(3);
```

---

## Running Tests

```bash
# Install Playwright once
npx playwright install

# Run all tests
npm test

# Run a single test file
npx playwright test test/api.spec.ts

# Run with verbose output
npx playwright test --reporter=list
```

---

## Anti-Patterns

```ts
// ❌ Calling real Anthropic API — tests must never do this
env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } // no ANTHROPIC_API_URL override

// ❌ Using supertest instead of Playwright request fixture
import request from 'supertest';

// ❌ Starting the NestJS app with require/import inside the test file
import { app } from '../src/main'; // wrong — use globalSetup

// ❌ Hardcoding port 3000 — always use APP_PORT constant to avoid conflicts
const res = await fetch('http://localhost:3000/api/health');

// ❌ Not awaiting the mock server close — causes port-in-use errors on re-run
mockServer.close(); // missing await
await new Promise<void>((r) => mockServer.close(r)); // ✅
```
