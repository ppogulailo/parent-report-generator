import { defineConfig } from '@playwright/test';

/**
 * Unit tests for the pure engine: scoring, rule evaluation, selection, content
 * validation, and the parity sweep that proves the transcribed methodology
 * behaves exactly like the live one.
 *
 * Deliberately separate from playwright.config.ts — this config starts no
 * server and no mock LLM, so it runs in a second and can gate every commit.
 * Playwright's runner is reused rather than adding Jest or Vitest, because this
 * repo already standardises on Playwright and one test runner is better than two.
 */
export default defineConfig({
  testDir: './test',
  testMatch: ['**/*.unit.spec.ts'],
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: { trace: 'off' },
});
