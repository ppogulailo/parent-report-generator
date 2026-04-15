import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

const MOCK_PORT = 4001;
const APP_PORT = 3001;

const MOCK_RESPONSE_BODY = JSON.stringify({
  choices: [
    {
      message: {
        role: 'assistant',
        content: [
          'HEADLINE SUMMARY',
          'You are taking a courageous step by addressing this situation directly.',
          '',
          'KEY PRIORITIES',
          'Immediate Safety & Urgency is the most pressing concern right now.',
          '',
          'WHAT TO AVOID',
          'Avoid issuing ultimatums without a clear follow-through plan.',
          '',
          'NEXT 7 DAYS ACTION PLAN',
          'Days 1–2: Have a calm, private conversation with your child.',
          '',
          'ENCOURAGEMENT & DIRECTION',
          'You are not alone. Many parents have navigated this successfully.',
        ].join('\n'),
      },
    },
  ],
});

export default async function globalSetup() {
  let lastRequest: { headers: http.IncomingHttpHeaders; body: any } | null =
    null;

  const mockServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/_last') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(lastRequest));
      return;
    }

    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        lastRequest = {
          headers: req.headers,
          body: raw ? JSON.parse(raw) : null,
        };
      } catch {
        lastRequest = { headers: req.headers, body: null };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(MOCK_RESPONSE_BODY);
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