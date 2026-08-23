import { defineConfig } from '@playwright/test';
import { APP_URL } from './test/v1/harness';

/**
 * The Version 1.0 API suite: the real HTTP endpoint, the real content, the real
 * selection and generation code, against a mock model.
 *
 * `workers: 1` because the mock holds one mode and one last-request at a time.
 * Tests that set the mode would race each other otherwise, and a flaky suite
 * that guards a methodology is worse than no suite.
 */
export default defineConfig({
  testDir: './test/v1',
  testMatch: ['**/*.v1.spec.ts'],
  globalSetup: './test/v1/global-setup.ts',
  globalTeardown: './test/v1/global-teardown.ts',
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: APP_URL },
  timeout: 60000,
});
