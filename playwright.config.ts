import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  globalSetup: './test/global-setup.ts',
  globalTeardown: './test/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${process.env.TEST_PORT ?? 3100}`,
  },
  timeout: 30000,
});