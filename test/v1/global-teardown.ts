import type { ChildProcess } from 'child_process';
import type { MockLlm } from './mock-llm';

export default async function globalTeardown(): Promise<void> {
  const global = globalThis as Record<string, unknown>;
  (global.__V1_APP__ as ChildProcess | undefined)?.kill();
  const mock = global.__V1_MOCK__ as MockLlm | undefined;
  if (mock) {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
}
