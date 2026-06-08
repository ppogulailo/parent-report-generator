import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

// Dedicated ports so this suite never collides with a dev stack the user may
// already be running on 3000/3100/4001.
const MOCK_PORT = 4111;
const BACKEND_PORT = 3010;
const FRONTEND_PORT = 3110;

// A real Parent Action Plan is generated in Spanish; the browser then
// auto-translates it. We stream the Spanish plan back over SSE, slowly, so the
// test has a realistic window in which React is mutating nodes while a
// translator races it. Headers use the EXACT accented ES markers the frontend
// parser keys on.
const REPORT_ES = [
  'RESUMEN INICIAL',
  'Lo que estás viendo ahora es significativo: las reglas en casa se han relajado y la comunicacion con tu hijo se complica. Lo notaste a tiempo.',
  '',
  '3 PRIORIDADES INMEDIATAS',
  '- Antes de cualquier movimiento, regula tu propio estado emocional.',
  '- Habla en privado con tu co-padre y acuerden las mismas reglas.',
  '- Unete y participa en el grupo de discusion "Monitoreo e Intervencion".',
  '',
  'PRIORIDADES CLAVE',
  'Consistencia de Limites: las reglas van y vienen segun el dia, lo que confunde a tu hijo.',
  'Define 3-4 reglas basicas y acuerda las consecuencias con tu co-padre.',
  'Si la situacion escala, asiste al Taller Esencial "Construyendo una Red de Apoyo", que incluye como involucrar a la escuela y a la comunidad.',
  'Marca una fecha de seguimiento en 7-10 dias. Si los patrones continuan, un terapeuta avalado por ASAP es el siguiente paso.',
  '',
  'QUÉ EVITAR',
  '- No inicies la conversacion desde el miedo o el enojo.',
  '- No apliques reglas y consecuencias de forma desigual.',
  '- No revises el cuarto de tu hijo de forma confrontativa.',
  '',
  'PLAN DE LAS PRIMERAS 72 HORAS',
  'DIA 1: Toma un respiro y regula tus emociones antes de hablar.',
  'DIA 2: Unete y publica en el grupo "Monitoreo e Intervencion".',
  'DIA 3: Prepara la conversacion con tu hijo: habla de lo que observaste y escucha sin interrumpir.',
  '',
  'DÍAS 4 A 7 — CONTINUACIÓN',
  'Continua aplicando las reglas y consecuencias de forma consistente cada noche.',
  'Reserva media hora para revisar como va todo y manten la calma.',
  '',
  'ALIENTO Y DIRECCIÓN',
  'Este camino requiere determinacion y perseverancia. Recuerda siempre: tu hijo no es el enemigo, y no estas solo en esto.',
].join('\n');

// Slow enough that a translator scanning every ~20ms can freeze paragraphs
// mid-growth — which is exactly how the truncation happens in the wild.
const CHUNK_DELAY_MS = 40;

function startMock(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let stream = false;
      try {
        stream = !!JSON.parse(Buffer.concat(chunks).toString('utf8')).stream;
      } catch {
        /* non-JSON */
      }
      if (!stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: REPORT_ES } }],
          }),
        );
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      const pieces = REPORT_ES.match(/[\s\S]{1,12}/g) ?? [REPORT_ES];
      let i = 0;
      const tick = () => {
        if (i < pieces.length) {
          res.write(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: pieces[i] }, finish_reason: null }],
            })}\n\n`,
          );
          i++;
          setTimeout(tick, CHUNK_DELAY_MS);
          return;
        }
        res.write(
          `data: ${JSON.stringify({
            choices: [{ delta: {}, finish_reason: 'stop' }],
          })}\n\n`,
        );
        res.write('data: [DONE]\n\n');
        res.end();
      };
      tick();
    });
  });
  return new Promise((resolve) =>
    server.listen(MOCK_PORT, () => resolve(server)),
  );
}

function waitForLog(
  proc: ChildProcess,
  needle: string,
  label: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} did not start within ${timeoutMs}ms`)),
      timeoutMs,
    );
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes(needle)) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', (c: Buffer) =>
      process.stderr.write(`[${label} stderr] ${c.toString()}`),
    );
    proc.on('error', reject);
  });
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const frontendDir = path.join(repoRoot, 'frontend');

  const mock = await startMock();

  const backend = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        API_SECRET_KEY: 'test-secret',
        OPENAI_API_KEY: 'mock-key',
        OPENAI_API_URL: `http://localhost:${MOCK_PORT}`,
        ALLOWED_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
      },
      stdio: 'pipe',
      // Own process group so teardown can kill npx + all its grandchildren.
      detached: true,
    },
  );
  await waitForLog(
    backend,
    'Nest application successfully started',
    'backend',
    40000,
  );

  const frontend = spawn('npx', ['next', 'dev', '-p', String(FRONTEND_PORT)], {
    cwd: frontendDir,
    env: {
      ...process.env,
      NEST_API_URL: `http://localhost:${BACKEND_PORT}`,
      NEST_API_KEY: 'test-secret',
    },
    stdio: 'pipe',
    detached: true,
  });
  frontend.stderr?.on('data', (c: Buffer) =>
    process.stderr.write(`[frontend stderr] ${c.toString()}`),
  );
  // `next dev` compiles a route on first hit; warm /es so tests don't pay it.
  await waitForHttp(`http://localhost:${FRONTEND_PORT}/es`, 90000);

  (global as any).__TRANSLATION_PROCS__ = { mock, backend, frontend };
}
