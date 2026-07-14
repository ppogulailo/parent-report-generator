import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

// Dedicated ports so this review harness never collides with a dev stack the
// user may already be running on 3000/3100/4001 (or the translation suite).
const MOCK_PORT = 4122;
const BACKEND_PORT = 3020;
const FRONTEND_PORT = 3120;

// A full CRITICAL (crisis) plan, EN + ES, INCLUDING the conditional
// CONSIDERING INPATIENT TREATMENT section (Beta finalization). Headers match
// the exact markers the frontend parser keys on (accents included for ES).
const REPORT_EN = [
  'URGENT CONCERN ACKNOWLEDGED',
  'You flagged a suspected overdose and talk of self-harm. Keep naloxone (Narcan) accessible and call Poison Control at 1-800-222-1222; if there is any active danger, call 911. The rest of this plan picks up from there.',
  '',
  'HEADLINE SUMMARY',
  'What you are carrying is heavy, and your instinct to act is right. The rest of this plan turns that instinct into steady, concrete steps.',
  '',
  'TOP 3 IMMEDIATE PRIORITIES',
  '- PARENT EMOTIONAL REGULATION — steady yourself before the next conversation.',
  '- CO-PARENT / CAREGIVER ALIGNMENT — you and your co-parent agree on rules, rewards, and consequences first.',
  "- BUILD YOUR PERSONAL SUPPORT GROUP — join and actively post in the 'Monitoring and Intervention discussion group.'",
  '',
  'KEY PRIORITIES',
  'Immediate Safety & Urgency is the most pressing concern right now.',
  '',
  'WHAT TO AVOID',
  '- Do not approach the conversation from a flare of fear or anger.',
  '',
  'FIRST 72 HOURS PLAN',
  'Day 1: Regulate and align with your co-parent on rules, rewards, and consequences.',
  'Day 2: Join the discussion group and conduct a complete room search calmly.',
  'Day 3: Prepare for the conversation with your child.',
  '',
  'DAYS 4 TO 7 CONTINUATION',
  '- Keep the rewards and consequences you and your co-parent agreed on consistent.',
  '',
  'CONSIDERING INPATIENT TREATMENT',
  'Removing a child from home for inpatient or residential treatment is one of the most difficult decisions a parent will ever make. It should never be made impulsively, but it should also not be delayed when your child’s safety is at risk. Strongly consider an ASAP-endorsed inpatient treatment program when one or more of the following circumstances exist:',
  '- Your child is a danger to themselves.',
  '- Your child is a danger to others.',
  "- Your child's substance use places them at significant risk of overdose or death.",
  '- You have exhausted reasonable outpatient interventions and treatment efforts without success.',
  "If these circumstances are present, seeking a higher level of care is not a failure — it is an act of protecting your child's life and future. For guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.",
  '',
  'ENCOURAGEMENT AND DIRECTION',
  'This takes determination and perseverance. Remember, your child is not the opponent — the substance use is, and this is you and your child against the drugs.',
].join('\n');

const REPORT_ES = [
  'PREOCUPACIÓN URGENTE RECONOCIDA',
  'Marcaste una sospecha de sobredosis y menciones de autolesión. Mantén naloxona (Narcan) accesible y llama a Poison Control at 1-800-222-1222; si hay peligro activo, llama al 911. El resto de este plan continúa desde aquí.',
  '',
  'RESUMEN INICIAL',
  'Lo que estás cargando es pesado, y tu instinto de actuar es acertado. El resto de este plan convierte ese instinto en pasos concretos y firmes.',
  '',
  '3 PRIORIDADES INMEDIATAS',
  '- REGULACIÓN EMOCIONAL DE LOS PADRES — regúlate antes de la próxima conversación.',
  '- ALINEACIÓN CO-PADRE / CUIDADOR — acuerden primero las reglas, recompensas y consecuencias.',
  "- CONSTRUIR TU GRUPO PERSONAL DE APOYO — únete y publica en el 'Monitoring and Intervention discussion group.'",
  '',
  'PRIORIDADES CLAVE',
  'La Seguridad Inmediata y Urgencia es la preocupación más apremiante ahora.',
  '',
  'QUÉ EVITAR',
  '- No abras la conversación desde un brote de miedo o rabia.',
  '',
  'PLAN DE LAS PRIMERAS 72 HORAS',
  'Día 1: Regúlate y alinéate con tu co-padre en reglas, recompensas y consecuencias.',
  'Día 2: Únete al grupo y realiza una revisión completa del cuarto con calma.',
  'Día 3: Prepara la conversación con tu hijo.',
  '',
  'DÍAS 4 A 7 — CONTINUACIÓN',
  '- Mantén consistentes las recompensas y consecuencias que tú y tu co-padre acordaron.',
  '',
  'CONSIDERAR EL TRATAMIENTO INTERNO O RESIDENCIAL',
  'Sacar a un hijo del hogar para un tratamiento interno o residencial es una de las decisiones más difíciles que un padre tomará jamás. Nunca debe tomarse de forma impulsiva, pero tampoco debe retrasarse cuando la seguridad de tu hijo está en riesgo. Considera seriamente un programa de tratamiento interno ASAP-endorsed cuando exista una o más de las siguientes circunstancias:',
  '- Tu hijo es un peligro para sí mismo.',
  '- Tu hijo es un peligro para otros.',
  '- El consumo de sustancias de tu hijo lo pone en riesgo significativo de sobredosis o muerte.',
  '- Has agotado las intervenciones ambulatorias razonables y los esfuerzos de tratamiento sin éxito.',
  'Si estas circunstancias están presentes, buscar un nivel de cuidado más alto no es un fracaso — es un acto de protección de la vida y el futuro de tu hijo. For guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.',
  '',
  'ALIENTO Y DIRECCIÓN',
  'Esto requiere determinación y perseverancia. Recuerda, tu hijo no es el oponente — el consumo lo es, y son tú y tu hijo contra las drogas.',
].join('\n');

// The two conditional, CRISIS-only sections (URGENT overlay + the inpatient
// section). Stripping them yields the 7-section non-crisis plan the model
// would produce when no crisis field was supplied.
const CRISIS_ONLY_HEADERS = [
  'URGENT CONCERN ACKNOWLEDGED',
  'CONSIDERING INPATIENT TREATMENT',
  'PREOCUPACIÓN URGENTE RECONOCIDA',
  'CONSIDERAR EL TRATAMIENTO INTERNO O RESIDENCIAL',
];

// Drop the crisis-only sections (header line + body lines up to the blank line)
// so a non-crisis request gets the plain 7-section plan.
function stripCrisisSections(report: string): string {
  const blocks = report.split('\n\n');
  return blocks
    .filter((b) => !CRISIS_ONLY_HEADERS.includes(b.split('\n')[0].trim()))
    .join('\n\n');
}

function planFor(userMessage: string): string {
  // The ES user prompt is built by buildUserPromptEs and contains this exact
  // Spanish instruction; the EN prompt does not.
  const isSpanish = userMessage.includes(
    'Genera un Plan de Acción para Padres',
  );
  // The crisis context block only appears when the parent filled the field.
  const isCrisis =
    userMessage.includes('URGENT CONCERN — parent flagged this') ||
    userMessage.includes('PREOCUPACIÓN URGENTE — el padre marcó esto');
  const full = isSpanish ? REPORT_ES : REPORT_EN;
  return isCrisis ? full : stripCrisisSections(full);
}

const CHUNK_DELAY_MS = 8;

function startMock(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* non-JSON */
      }
      const userMessage: string = parsed?.messages?.[1]?.content ?? '';
      const report = planFor(userMessage);

      if (!parsed?.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: report } }],
          }),
        );
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      const pieces = report.match(/[\s\S]{1,24}/g) ?? [report];
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
    proc.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(needle)) {
        clearTimeout(timer);
        resolve();
      }
    });
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
  await waitForHttp(`http://localhost:${FRONTEND_PORT}/en`, 90000);

  (global as any).__INPATIENT_PROCS__ = { mock, backend, frontend };
}
