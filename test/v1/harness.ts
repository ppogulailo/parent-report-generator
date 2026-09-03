import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Helpers shared by the V1 API and browser suites.
 *
 * The mock's control routes are the interesting part: they let a test say "now
 * behave like a model that forgets the required wording" and assert what the
 * platform does about it.
 */
export const MOCK_PORT = Number(process.env.V1_MOCK_PORT ?? 4599);
export const APP_PORT = Number(process.env.V1_APP_PORT ?? 3401);
export const APP_URL = `http://localhost:${APP_PORT}`;
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;
export const API_KEY = 'test-secret';
/** The saved-plans database for the suite. Local Postgres, own database, so a
 *  test run can never touch development data. */
export const TEST_DATABASE_URL =
  process.env.V1_TEST_DATABASE_URL ??
  `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/mi_test?schema=public`;
/** Deterministic key so encrypted fixtures stay readable within a run. */
export const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

export type MockMode =
  | 'valid'
  | 'wording-then-fixed'
  | 'wording-always'
  | 'invents-workshop'
  | 'omits-recommendation'
  | 'writes-static-section'
  | 'not-json'
  | 'slow';

export async function setMode(
  request: APIRequestContext,
  mode: MockMode,
): Promise<void> {
  const response = await request.post(`${MOCK_URL}/_mode/${mode}`);
  expect(response.ok(), `could not set mock mode to ${mode}`).toBe(true);
}

export async function resetMock(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${MOCK_URL}/_reset`);
  expect(response.ok(), 'could not reset the mock').toBe(true);
}

export async function lastPrompt(
  request: APIRequestContext,
): Promise<{ system: string; user: string; turns: number } | null> {
  const response = await request.get(`${MOCK_URL}/_last`);
  return (await response.json()) as {
    system: string;
    user: string;
    turns: number;
  } | null;
}

export async function requestCount(
  request: APIRequestContext,
): Promise<number> {
  const response = await request.get(`${MOCK_URL}/_count`);
  const body = (await response.json()) as { requests: number };
  return body.requests;
}

/** A complete submission. `base` fills every question; `overrides` are by id. */
export function submission(
  base: number,
  overrides: Record<string, number> = {},
): Record<string, number> {
  const responses: Record<string, number> = {};
  for (let i = 1; i <= 24; i++) {
    responses[`q${String(i).padStart(2, '0')}`] = base;
  }
  return { ...responses, ...overrides };
}
