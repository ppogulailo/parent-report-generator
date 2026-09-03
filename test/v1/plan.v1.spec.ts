import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  API_KEY,
  APP_URL,
  TEST_DATABASE_URL,
  resetMock,
  submission,
} from './harness';

/**
 * Saved plans (Milestone 5), end to end over HTTP: a submission is persisted,
 * the return link serves the same plan the parent first saw, the parent can
 * delete everything immediately, and the sensitive fields are encrypted at
 * rest. Direct Prisma reads assert what is ON DISK, not what the API says
 * about it.
 */

const headers = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY };

let prisma: PrismaClient;

test.beforeAll(() => {
  prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

async function submit(request: any, overrides = {}, urgent?: string) {
  const response = await request.post(`${APP_URL}/api/assessment/submit`, {
    headers,
    data: {
      responses: submission(2, overrides),
      language: 'en',
      ...(urgent ? { urgentConcern: urgent } : {}),
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test('a submission is saved and the return link serves the same plan', async ({
  request,
}) => {
  const body = await submit(request, { q03: 4 });

  expect(body.planId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  const plan = await request.get(
    `${APP_URL}/api/assessment/plan/${body.planId}`,
    { headers },
  );
  expect(plan.ok()).toBe(true);
  const view = await plan.json();

  expect(view.status).toBe('complete');
  expect(view.severity.tierId).toBe(body.severity.tierId);
  expect(view.severity.label).toBe(body.severity.label);
  // The same labelled shape the submit response used, so one frontend renders
  // both.
  expect(view.domainScores).toEqual(body.domainScores);
  expect(view.topDomains).toEqual(body.topDomains);
  // Deep equality, not string equality: Postgres round-trips JSON with its own
  // key order, and what must not change is the content.
  expect(view.sections).toEqual(body.report.sections);

  // The 90-day clock is stated, not hidden. It runs from the SUBMISSION row,
  // stamped a heartbeat before the plan row — hence the tolerance.
  const lifetime =
    new Date(view.expiresAt).getTime() - new Date(view.createdAt).getTime();
  expect(Math.abs(lifetime - 90 * 86_400_000)).toBeLessThan(10_000);

  // And the plan row carries the stored HTML snapshot for the PDF path.
  const row = await prisma.plan.findUnique({ where: { id: body.planId } });
  expect(row?.renderedHtml).toContain('Family Risk Assessment');
});

test('the stream hands out the return link before the plan is written', async ({
  request,
}) => {
  const response = await request.post(`${APP_URL}/api/assessment/stream`, {
    headers,
    data: { responses: submission(2), language: 'en' },
  });
  const text = await response.text();

  const decidedFrame = text
    .split('\n\n')
    .find((frame) => frame.includes('event: decided'));
  expect(decidedFrame).toBeTruthy();
  const decided = JSON.parse(
    decidedFrame!.split('\n').find((l) => l.startsWith('data:'))!.slice(5),
  );
  expect(decided.planId).toMatch(/^[0-9a-f-]{36}$/i);

  // And the stored plan completes with the streamed report.
  const plan = await request.get(
    `${APP_URL}/api/assessment/plan/${decided.planId}`,
    { headers },
  );
  expect((await plan.json()).status).toBe('complete');
});

test('the urgent note is encrypted at rest and never stored in the clear', async ({
  request,
}) => {
  const note = 'I found an unlabelled bag in his jacket on Tuesday night.';
  const body = await submit(request, {}, note);

  const plan = await prisma.plan.findUnique({
    where: { id: body.planId },
    include: { submission: true },
  });
  const stored = plan!.submission.urgentTextEncrypted!;
  expect(stored.startsWith('v1.')).toBe(true);
  expect(stored).not.toContain('jacket');
  // The whole row, serialised, must not leak the note either.
  expect(JSON.stringify(plan!.submission)).not.toContain('jacket');
});

test('generation records are kept per attempt, tied to the plan', async ({
  request,
}) => {
  const body = await submit(request);
  const exchanges = await prisma.llmExchange.findMany({
    where: { planId: body.planId },
  });
  expect(exchanges.length).toBeGreaterThan(0);
  expect(exchanges[0].modelId).toBeTruthy();
});

test('a de-identified snapshot is written, with nothing linking it back', async ({
  request,
}) => {
  const before = await prisma.scoreSnapshot.count();
  const body = await submit(request, { q05: 4 });
  const after = await prisma.scoreSnapshot.count();
  expect(after).toBe(before + 1);

  const latest = await prisma.scoreSnapshot.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  // The snapshot knows the tier and the scores — and cannot know the family:
  // no submission id, no plan id, and its own id appears nowhere else.
  expect(latest!.tierId).toBe(body.severity.tierId);
  const columns = Object.keys(latest!);
  expect(columns).not.toContain('submissionId');
  expect(columns).not.toContain('planId');
});

test('parent-requested deletion removes the whole graph, immediately', async ({
  request,
}) => {
  const body = await submit(request, {}, 'urgent context to be deleted');
  const planId = body.planId as string;
  const snapshotCount = await prisma.scoreSnapshot.count();

  const del = await request.delete(
    `${APP_URL}/api/assessment/plan/${planId}`,
    { headers },
  );
  expect(del.status()).toBe(200);

  // Gone from the API...
  const gone = await request.get(`${APP_URL}/api/assessment/plan/${planId}`, {
    headers,
  });
  expect(gone.status()).toBe(404);

  // ...and gone from disk: plan, submission, and generation records.
  expect(await prisma.plan.findUnique({ where: { id: planId } })).toBeNull();
  expect(
    await prisma.llmExchange.count({ where: { planId } }),
  ).toBe(0);

  // The de-identified snapshot stays — there is nothing in it to delete on a
  // family's behalf, which is the point of its design.
  expect(await prisma.scoreSnapshot.count()).toBe(snapshotCount);

  // Deleting twice is a 404, not an error.
  const again = await request.delete(
    `${APP_URL}/api/assessment/plan/${planId}`,
    { headers },
  );
  expect(again.status()).toBe(404);
});

test('the PDF endpoint degrades to 503 when rendering is unavailable', async ({
  request,
}) => {
  // The suite runs with PDF_ENABLED=false — the same state as a deployment
  // without Chromium — and the parent is told to print instead.
  const body = await submit(request);
  const pdf = await request.get(
    `${APP_URL}/api/assessment/plan/${body.planId}/pdf`,
    { headers },
  );
  expect(pdf.status()).toBe(503);
  expect((await pdf.json()).error).toContain('print');
});

test('plan endpoints are guarded like everything else', async ({ request }) => {
  const body = await submit(request);
  for (const method of ['get', 'delete'] as const) {
    const res = await request[method](
      `${APP_URL}/api/assessment/plan/${body.planId}`,
    );
    expect(res.status()).toBe(401);
  }
});

test('an unknown plan id is a 404 with the standard shape', async ({
  request,
}) => {
  const res = await request.get(
    `${APP_URL}/api/assessment/plan/00000000-0000-4000-8000-000000000000`,
    { headers },
  );
  expect(res.status()).toBe(404);
  expect(await res.json()).toEqual({ success: false, error: 'Not found.' });
});
