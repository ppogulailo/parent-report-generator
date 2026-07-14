import { defineConfig, devices } from '@playwright/test';

// Self-contained browser review for the CRITICAL-only CONSIDERING INPATIENT
// TREATMENT section. globalSetup boots an SSE mock OpenAI (returning a full
// 9-section crisis plan, EN + ES, incl. the inpatient section), the NestJS
// backend, and the Next.js frontend on dedicated ports. Run:
//   npx playwright test --config=playwright.inpatient-review.config.ts
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3120';

export default defineConfig({
  testDir: './test/ui',
  testMatch: '**/critical-inpatient.spec.ts',
  globalSetup: './test/ui/critical-inpatient.global-setup.ts',
  globalTeardown: './test/ui/critical-inpatient.global-teardown.ts',
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: FRONTEND_URL,
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
