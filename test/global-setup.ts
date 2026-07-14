import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

const MOCK_PORT = 4001;
const APP_PORT = Number(process.env.TEST_PORT ?? 3100);

const BASE_SECTIONS = [
  'HEADLINE SUMMARY',
  'You are taking a courageous step by addressing this situation directly.',
  '',
  'TOP 3 IMMEDIATE PRIORITIES',
  '- Have a calm, private conversation with your child today.',
  '- Remove or secure any substances you are aware of in the home.',
  '- Write down the one boundary you will enforce this week.',
  '',
  'KEY PRIORITIES',
  'Immediate Safety & Urgency is the most pressing concern right now.',
  '',
  'WHAT TO AVOID',
  '- Avoid issuing ultimatums without a clear follow-through plan.',
  '',
  'FIRST 72 HOURS PLAN',
  'Day 1: Sit down with your child for a short, calm conversation.',
  'Day 2: Reach out to one professional resource.',
  'Day 3: Review and adjust your household boundaries.',
  '',
  'DAYS 4 TO 7 CONTINUATION',
  '- Keep daily check-ins short and consistent.',
  '',
  'ENCOURAGEMENT AND DIRECTION',
  'You are not alone. Many parents have navigated this successfully.',
];

const URGENT_BLOCK = [
  'URGENT CONCERN ACKNOWLEDGED',
  'You flagged something acute and we are addressing it before anything else. Call the pinned emergency resource now. The rest of this plan picks up from there.',
  '',
];

// Conditional CRITICAL-only section, inserted before ENCOURAGEMENT AND
// DIRECTION when the crisis field fires (early-intervention plan only).
const INPATIENT_BLOCK = [
  'CONSIDERING INPATIENT TREATMENT',
  'Removing a child from home for inpatient or residential treatment is one of the hardest decisions a parent makes. Strongly consider an ASAP-endorsed inpatient treatment program when one or more of these exist:',
  '- Your child is a danger to themselves.',
  '- Your child is a danger to others.',
  "- Your child's substance use places them at significant risk of overdose or death.",
  '- You have exhausted reasonable outpatient interventions and treatment efforts without success.',
  "Seeking a higher level of care is not a failure — it is an act of protecting your child's life and future. For guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.",
  '',
];

// Insert the CRITICAL-only inpatient section just before the final
// ENCOURAGEMENT AND DIRECTION section of the early-intervention plan.
function withInpatientSection(sections: string[]): string[] {
  const idx = sections.indexOf('ENCOURAGEMENT AND DIRECTION');
  if (idx === -1) return sections;
  return [
    ...sections.slice(0, idx),
    ...INPATIENT_BLOCK,
    ...sections.slice(idx),
  ];
}

// Sustaining Recovery (post-treatment) plan — different section structure than
// the early-intervention plan above. The mock returns these when the outgoing
// user prompt identifies itself as the SUSTAINING RECOVERY plan.
const SR_BASE_SECTIONS = [
  'WELCOME HOME SUMMARY',
  'Your child is home from treatment and the early weeks are the fragile part. This plan keeps the recovery line steady.',
  '',
  'TOP 3 IMMEDIATE PRIORITIES',
  '- Regulate yourself first; the hypervigilance is doing some of the talking.',
  '- Get aligned with your co-parent on the recovery plan.',
  "- Join and actively post in the 'Monitoring and Intervention discussion group.'",
  '',
  'REBUILDING DAILY STRUCTURE',
  'Rebuild a predictable routine and secure the home environment.',
  '',
  'RELAPSE WARNING SIGNS',
  'Watch for the specific signals tied to your child and respond, do not panic.',
  '',
  'WHAT TO AVOID',
  '- Avoid over-policing into secrecy, and do not drop aftercare once things seem fine.',
  '',
  'FIRST TWO WEEKS PLAN',
  'Week 1: regulation, co-parent alignment, secure the environment, confirm aftercare.',
  'Week 2: routine, accountability check-ins, first calm recovery check-in.',
  '',
  'ONGOING SUPPORT AND ENCOURAGEMENT',
  'Recovery is long-term, and a setback does not erase the progress already made.',
];

const SR_URGENT_BLOCK = [
  'URGENT CONCERN ACKNOWLEDGED',
  'You flagged something acute since your child came home. Call the pinned emergency resource now. The rest of this plan picks up from there.',
  '',
];

function buildResponseBody(userMessage: string): string {
  // Detect on the user-prompt context-block header that ONLY appears when
  // the parent supplied a non-empty crisis field. The static instruction
  // text mentions "URGENT CONCERN ACKNOWLEDGED" in both branches (firing
  // and non-firing), so a broader substring match would over-fire.
  const isCrisis = userMessage.includes('URGENT CONCERN — parent flagged this');
  const isSustainingRecovery = userMessage.includes(
    'SUSTAINING RECOVERY Parent Action Plan',
  );

  const base = isSustainingRecovery ? SR_BASE_SECTIONS : BASE_SECTIONS;
  const urgent = isSustainingRecovery ? SR_URGENT_BLOCK : URGENT_BLOCK;
  // The CONSIDERING INPATIENT TREATMENT section is CRITICAL-only and belongs
  // to the early-intervention plan (not the Sustaining Recovery plan).
  const crisisBase =
    isCrisis && !isSustainingRecovery ? withInpatientSection(base) : base;
  const content = (isCrisis ? [...urgent, ...crisisBase] : base).join('\n');
  return JSON.stringify({
    choices: [
      {
        message: {
          role: 'assistant',
          content,
        },
      },
    ],
  });
}

export default async function globalSetup() {
  let lastRequest: { headers: http.IncomingHttpHeaders; body: any } | null =
    null;

  const mockServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/_last') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lastRequest));
      return;
    }

    // Buffer the raw bytes and decode once at the end. Concatenating
    // chunk.toString() corrupts multi-byte UTF-8 chars (e.g. "número") when
    // one straddles a TCP chunk boundary.
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let userMessage = '';
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        lastRequest = { headers: req.headers, body: parsed };
        userMessage = parsed?.messages?.[1]?.content ?? '';
      } catch {
        lastRequest = { headers: req.headers, body: null };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(buildResponseBody(userMessage));
    });
  });

  await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, resolve));
  (global as any).__MOCK_SERVER__ = mockServer;

  const appProcess: ChildProcess = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        API_SECRET_KEY: 'test-secret',
        OPENAI_API_KEY: 'mock-key',
        OPENAI_API_URL: `http://localhost:${MOCK_PORT}`,
      },
      stdio: 'pipe',
    },
  );

  await new Promise<void>((resolve, reject) => {
    appProcess.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Nest application successfully started')) {
        resolve();
      }
    });
    appProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[app stderr]', chunk.toString());
    });
    appProcess.on('error', reject);
    setTimeout(() => reject(new Error('App did not start within 20s')), 20000);
  });

  (global as any).__APP_PROCESS__ = appProcess;
}
