import { defineConfig, devices } from '@playwright/test';
import { APP_PORT, API_KEY } from './test/v1/harness';

/**
 * The Version 1.0 browser suite.
 *
 * Self-contained, unlike `playwright.ui.config.ts` which drives an
 * already-running frontend: this one starts the mock model and the API through
 * `globalSetup`, and the Next dev server through `webServer`. That matters
 * because the thing worth testing here is the whole path — a parent filling in
 * radio buttons, through the proxy, through selection and generation, back to
 * rendered sections with workshop links.
 *
 * `reuseExistingServer` is off: a stale dev server on this port holding older
 * code is the classic way to spend an hour debugging a passing test.
 */
const FRONTEND_PORT = Number(process.env.V1_FRONTEND_PORT ?? 3402);

export default defineConfig({
  testDir: './test/v1',
  testMatch: ['**/*.v1ui.spec.ts'],
  globalSetup: './test/v1/global-setup.ts',
  globalTeardown: './test/v1/global-teardown.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    viewport: { width: 1280, height: 900 },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // `npm run dev` hardcodes -p 3100, so the port is passed explicitly rather
    // than through PORT, which Next ignores when the flag is present.
    command: `npx next dev -p ${FRONTEND_PORT}`,
    cwd: './frontend',
    port: FRONTEND_PORT,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEST_API_URL: `http://localhost:${APP_PORT}`,
      NEST_API_KEY: API_KEY,
    },
  },
});
