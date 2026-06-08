import * as http from 'http';
import { ChildProcess } from 'child_process';

// Children are spawned with `detached: true`, so each leads its own process
// group. Killing the negative PID reaps npx AND its grandchildren (ts-node,
// the Next dev worker) — a plain proc.kill() would orphan them.
function killTree(proc: ChildProcess | undefined) {
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, 'SIGKILL');
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

export default async function globalTeardown() {
  const procs = (global as any).__TRANSLATION_PROCS__ as
    | { mock: http.Server; backend: ChildProcess; frontend: ChildProcess }
    | undefined;
  if (!procs) return;
  killTree(procs.backend);
  killTree(procs.frontend);
  await new Promise<void>((resolve) => procs.mock.close(() => resolve()));
}
