import { defineConfig, devices } from '@playwright/test';

// UI test suite — runs browser-driven tests against the already-running
// Next.js frontend at http://localhost:3100. Does NOT spawn the NestJS
// backend or a mock server; tests here avoid paths that require generation.

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './test/ui',
  timeout: 30000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: FRONTEND_URL,
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
