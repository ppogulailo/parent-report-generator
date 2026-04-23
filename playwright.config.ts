import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  // UI tests live under test/ui/ and require a running Next.js dev server +
  // a chromium install. They run via `playwright.ui.config.ts`, not this one.
  testIgnore: ['ui/**'],
  globalSetup: './test/global-setup.ts',
  globalTeardown: './test/global-teardown.ts',
  // Tests share a single mock server that records the last request, so they
  // must run serially to avoid cross-test interference.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${process.env.TEST_PORT ?? 3100}`,
  },
  timeout: 30000,
});