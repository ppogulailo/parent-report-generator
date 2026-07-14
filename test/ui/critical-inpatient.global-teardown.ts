import * as http from 'http';
import { ChildProcess } from 'child_process';

// Children are spawned detached (own process group); kill the negative PID so
// npx AND its grandchildren (ts-node, the Next dev worker) are reaped.
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
  const procs = (global as any).__INPATIENT_PROCS__ as
    | { mock: http.Server; backend: ChildProcess; frontend: ChildProcess }
    | undefined;
  if (!procs) return;
  killTree(procs.backend);
  killTree(procs.frontend);
  await new Promise<void>((resolve) => procs.mock.close(() => resolve()));
}
