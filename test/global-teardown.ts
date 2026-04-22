export default async function globalTeardown() {
  (global as any).__APP_PROCESS__?.kill();
  await new Promise<void>((resolve) =>
    (global as any).__MOCK_SERVER__?.close(resolve),
  );
}
