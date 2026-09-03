import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { API_KEY, APP_URL, TEST_DATABASE_URL, submission } from './harness';
import { RetentionService } from '../../src/persistence/retention.service';
import type { PrismaService } from '../../src/persistence/prisma.service';

/**
 * The retention clocks (90/30, approved 2026-09-02), exercised against the
 * real database. Rows are seeded through the real API and then BACKDATED into
 * the past, so the sweep runs with the real current time — a sweep pointed at
 * a future "now" would eat every row the rest of the suite created.
 */

const headers = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY };
const DAY = 86_400_000;

let prisma: PrismaClient;
let retention: RetentionService;

test.beforeAll(() => {
  prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
  // The service only needs a working client; PrismaService is a PrismaClient
  // with boot logging on top.
  retention = new RetentionService(prisma as unknown as PrismaService);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function seedPlan(request: any): Promise<{ planId: string; submissionId: string }> {
  const response = await request.post(`${APP_URL}/api/assessment/submit`, {
    headers,
    data: {
      responses: submission(2),
      language: 'en',
      urgentConcern: 'note that must not outlive thirty days',
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const { planId } = await response.json();
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: planId },
    select: { submissionId: true },
  });
  return { planId, submissionId: plan.submissionId };
}

async function backdate(submissionId: string, planId: string, days: number) {
  const then = new Date(Date.now() - days * DAY);
  await prisma.submission.update({
    where: { id: submissionId },
    data: { createdAt: then },
  });
  await prisma.plan.update({ where: { id: planId }, data: { createdAt: then } });
  await prisma.llmExchange.updateMany({
    where: { planId },
    data: { createdAt: then },
  });
}

test('at 30 days the answers, the note and the records go — the plan stays', async ({
  request,
}) => {
  const { planId, submissionId } = await seedPlan(request);
  await backdate(submissionId, planId, 31);

  const result = await retention.sweep();
  expect(result.submissionsScrubbed).toBeGreaterThanOrEqual(1);

  const sub = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
  });
  expect(sub.responses).toEqual({});
  expect(sub.urgentTextEncrypted).toBeNull();
  expect(sub.scrubbedAt).not.toBeNull();
  expect(await prisma.llmExchange.count({ where: { planId } })).toBe(0);

  // The plan itself is promised 90 days and is untouched.
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  expect(plan.status).toBe('complete');
  expect(plan.sections).not.toBeNull();

  // And the return link still works after the scrub.
  const view = await request.get(`${APP_URL}/api/assessment/plan/${planId}`, {
    headers,
  });
  expect(view.ok()).toBe(true);
  expect((await view.json()).status).toBe('complete');
});

test('a scrub is not repeated — one stamp, one pass', async ({ request }) => {
  const { planId, submissionId } = await seedPlan(request);
  await backdate(submissionId, planId, 31);
  await retention.sweep();
  const first = (await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
  })).scrubbedAt;

  const second = await retention.sweep();
  const after = (await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
  })).scrubbedAt;
  expect(after!.getTime()).toBe(first!.getTime());
  // Nothing new to scrub from this row.
  void second;
});

test('at 90 days the whole graph goes; the de-identified snapshot stays', async ({
  request,
}) => {
  const { planId, submissionId } = await seedPlan(request);
  await backdate(submissionId, planId, 91);
  const snapshots = await prisma.scoreSnapshot.count();

  const result = await retention.sweep();
  expect(result.submissionsDeleted).toBeGreaterThanOrEqual(1);

  expect(
    await prisma.submission.findUnique({ where: { id: submissionId } }),
  ).toBeNull();
  expect(await prisma.plan.findUnique({ where: { id: planId } })).toBeNull();
  expect(await prisma.scoreSnapshot.count()).toBe(snapshots);

  // The dead link fails politely, which the plan page turns into "no longer
  // available" with a road back to the assessment.
  const view = await request.get(`${APP_URL}/api/assessment/plan/${planId}`, {
    headers,
  });
  expect(view.status()).toBe(404);
});

test('a fresh plan is untouched by the sweep', async ({ request }) => {
  const { planId } = await seedPlan(request);
  await retention.sweep();
  const view = await request.get(`${APP_URL}/api/assessment/plan/${planId}`, {
    headers,
  });
  expect(view.ok()).toBe(true);
  const body = await view.json();
  expect(body.status).toBe('complete');
});
