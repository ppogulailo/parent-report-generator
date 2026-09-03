import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { startMockLlm } from './mock-llm';
import {
  APP_PORT,
  API_KEY,
  MOCK_PORT,
  TEST_DATABASE_URL,
  TEST_ENCRYPTION_KEY,
} from './harness';

/**
 * Boots the mock model and the Nest app for the Version 1.0 suites.
 *
 * Separate from `test/global-setup.ts`, which serves the old endpoint and returns
 * markdown sections. Different ports so both suites can run in the same session
 * without fighting over one.
 */
export default async function globalSetup(): Promise<void> {
  const mock = await startMockLlm(MOCK_PORT);
  (globalThis as Record<string, unknown>).__V1_MOCK__ = mock;

  // Saved plans (Milestone 5) need a real Postgres. Migrations run here so a
  // missing table fails as "migrate failed", not as an opaque mid-test error.
  const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: process.env.V1_TEST_LOGS ? 'inherit' : 'ignore',
    shell: false,
  });
  if (migrate.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed against ${TEST_DATABASE_URL.replace(/\/\/[^@]*@/, '//<user>@')} — the v1 suite needs a local Postgres with that database (createdb mi_test)`,
    );
  }

  const app: ChildProcess = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        API_SECRET_KEY: API_KEY,
        OPENAI_API_KEY: 'mock-key',
        OPENAI_API_URL: `http://localhost:${MOCK_PORT}`,
        DATABASE_URL: TEST_DATABASE_URL,
        FIELD_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
        // The mock cannot render a PDF and the suite must not need Chromium.
        PDF_ENABLED: 'false',
        // Content is loaded from the shipped `content/` on purpose. A fixture
        // bundle would let a broken routing rule pass the suite.
      },
      stdio: 'pipe',
    },
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('the app did not start within 30s')),
      30000,
    );
    app.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Nest application successfully started')) {
        clearTimeout(timer);
        resolve();
      }
    });
    // Boot failures here are almost always content validation, and the message
    // says exactly which rule — so it must reach the console rather than being
    // swallowed into a timeout.
    app.stderr?.on('data', (chunk: Buffer) =>
      console.error('[app]', chunk.toString()),
    );
    app.on('error', reject);
  });

  (globalThis as Record<string, unknown>).__V1_APP__ = app;
}
