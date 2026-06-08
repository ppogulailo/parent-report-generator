import { defineConfig, devices } from '@playwright/test';

// Self-contained suite that reproduces the browser-auto-translation vs.
// streaming-React truncation bug and verifies the translate="no" gate fixes
// it. globalSetup boots an SSE mock OpenAI, the NestJS backend, and the Next
// frontend on dedicated ports (4111 / 3010 / 3110), so it runs with a single
// `npx playwright test --config=playwright.translation.config.ts`.

const FRONTEND_PORT = 3110;

export default defineConfig({
  testDir: './test/ui',
  testMatch: '**/streaming-translation.spec.ts',
  globalSetup: './test/ui/translation.global-setup.ts',
  globalTeardown: './test/ui/translation.global-teardown.ts',
  timeout: 45000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
