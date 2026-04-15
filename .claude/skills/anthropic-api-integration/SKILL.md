---
name: anthropic-api-integration
description: Anthropic Claude API integration patterns for this project. Use when writing or modifying ClaudeService, calling the Anthropic messages endpoint, parsing AI responses, handling API errors, or mocking the Anthropic API in Playwright tests. Covers correct headers, request shape, response parsing, section extraction, error handling, and NestJS HttpService wiring.
---

# Anthropic API Integration — Project Patterns

This project calls the Anthropic API from `src/report/claude/claude.service.ts` using NestJS `HttpService`. Read this before touching anything in that file or writing tests that involve the Anthropic API.

---

## The Complete ClaudeService

Canonical implementation. Don't deviate from this shape.

```ts
// src/report/claude/claude.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { buildUserPrompt, SYSTEM_PROMPT } from '../prompts';
import { ReportSections } from '../interfaces/report.interface';

@Injectable()
export class ClaudeService {
  private readonly apiKey: string;
  private readonly model = 'claude-sonnet-4-20250514';
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.getOrThrow<string>('ANTHROPIC_API_KEY');
    this.apiUrl = this.configService.get<string>(
      'ANTHROPIC_API_URL',
      'https://api.anthropic.com/v1/messages', // overridable for tests
    );
  }

  async generateReport(
    domainScores: Record<string, number>,
    topDomains: string[],
  ): Promise<ReportSections> {
    const userPrompt = buildUserPrompt(domainScores, topDomains);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            model: this.model,
            max_tokens: 2000,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          },
          {
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
          },
        ),
      );

      const text: string = response.data.content[0].text;
      return this.parseSections(text);
    } catch {
      throw new InternalServerErrorException(
        'Report generation failed. Please try again.',
      );
    }
  }

  private parseSections(text: string): ReportSections {
    const extract = (label: string): string => {
      const pattern = new RegExp(
        `${label}\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s&]+\\n|$)`,
        'i',
      );
      const match = text.match(pattern);
      return match ? match[1].trim() : '';
    };

    return {
      headlineSummary: extract('HEADLINE SUMMARY'),
      keyPriorities:   extract('KEY PRIORITIES'),
      whatToAvoid:     extract('WHAT TO AVOID'),
      next7Days:       extract('NEXT 7 DAYS ACTION PLAN'),
      encouragement:   extract('ENCOURAGEMENT & DIRECTION'),
    };
  }
}
```

---

## Request Shape

The Anthropic `/v1/messages` endpoint requires this exact shape. Never use the `prompt` field — that is the legacy completions API.

```ts
// ✅ Correct
{
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2000,
  system: SYSTEM_PROMPT,          // top-level field, not inside messages[]
  messages: [
    { role: 'user', content: userPrompt },
  ],
}

// ❌ Wrong — legacy completions format
{
  prompt: `\n\nHuman: ${userPrompt}\n\nAssistant:`,
  max_tokens_to_sample: 2000,
}

// ❌ Wrong — system does not go inside messages[]
{
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ],
}
```

---

## Required Headers

All three are mandatory. Missing any one causes a 4xx from Anthropic.

```ts
// ✅ Correct
headers: {
  'x-api-key': this.apiKey,
  'anthropic-version': '2023-06-01',  // always this exact string
  'content-type': 'application/json',
}

// ❌ Wrong key name — will 401
headers: {
  'Authorization': `Bearer ${this.apiKey}`,
}

// ❌ Missing anthropic-version — will 400
headers: {
  'x-api-key': this.apiKey,
  'content-type': 'application/json',
}
```

---

## Parsing the Response

The Anthropic response shape is always:

```json
{
  "content": [
    {
      "type": "text",
      "text": "...the full AI string..."
    }
  ]
}
```

Always read `response.data.content[0].text`.

```ts
// ✅ Correct
const text: string = response.data.content[0].text;

// ❌ Wrong — content is an array, not an object
const text = response.data.content.text;

// ❌ Wrong — this field does not exist
const text = response.data.text;
```

---

## Section Parsing

The AI returns all 5 sections in one string. `parseSections` extracts each block using the fixed section name as an anchor.

Expected AI output format:

```
HEADLINE SUMMARY
You're taking an important step by facing this situation directly...

KEY PRIORITIES
1. Immediate Safety & Urgency
...

WHAT TO AVOID
1. Avoid issuing ultimatums without a clear follow-through plan...

NEXT 7 DAYS ACTION PLAN
Days 1–2: Schedule a calm, private conversation...

ENCOURAGEMENT & DIRECTION
You don't have to solve everything at once...
```

If the AI omits a section, `parseSections` returns `''` for that key — it does not throw. Empty sections are not a server error.

```ts
// ❌ Don't throw on a missing section
if (!headlineSummary) throw new Error('Missing section');

// ✅ Return empty string, let the client handle it
headlineSummary: extract('HEADLINE SUMMARY') ?? '',
```

---

## Prompt Files

System prompt and user prompt builder live in `src/report/prompts/`. Export both from `index.ts`.

```ts
// src/report/prompts/system.prompt.ts
export const SYSTEM_PROMPT = `You are a highly experienced parent guidance specialist focused on adolescent substance use intervention.

Your role is to generate a clear, structured, and emotionally supportive Parent Action Plan based on questionnaire results.

This is NOT generic advice. This must feel specific, practical, and directly relevant to the parent's situation.

Use a calm, confident, and supportive tone. Avoid clinical or overly technical language. Write as if you are guiding a concerned parent step-by-step.`;
```

```ts
// src/report/prompts/user.prompt.ts
export function buildUserPrompt(
  domainScores: Record<string, number>,
  topDomains: string[],
): string {
  return `Domain Scores:
- Immediate Safety & Urgency: ${domainScores['Immediate Safety & Urgency'].toFixed(2)}
- Household Structure: ${domainScores['Household Structure'].toFixed(2)}
- Boundary Consistency: ${domainScores['Boundary Consistency'].toFixed(2)}
- Communication & Conflict: ${domainScores['Communication & Conflict'].toFixed(2)}
- Support & Professional Engagement: ${domainScores['Support & Professional Engagement'].toFixed(2)}

Top 3 Priority Domains: ${topDomains[0]}, ${topDomains[1]}, ${topDomains[2]}

Generate a Parent Action Plan following the required output structure exactly.`;
}
```

```ts
// src/report/prompts/index.ts
export { SYSTEM_PROMPT } from './system.prompt';
export { buildUserPrompt } from './user.prompt';
```

Never modify `SYSTEM_PROMPT`. It is defined in the spec and must not be paraphrased, shortened, or reworded.

---

## NestJS Wiring

`ClaudeService` needs `HttpModule` in its module and `ConfigModule` global in `AppModule`.

```ts
// report.module.ts
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],  // provides HttpService to ClaudeService
  providers: [ReportService, ScoringService, ClaudeService],
  controllers: [ReportController],
})
export class ReportModule {}

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // makes ConfigService available everywhere
    ReportModule,
    HealthModule,
  ],
})
export class AppModule {}
```

Always use `getOrThrow` — the app must crash at startup if `ANTHROPIC_API_KEY` is missing, not silently fail at the first request.

```ts
// ✅ Fails fast at startup
this.apiKey = this.configService.getOrThrow<string>('ANTHROPIC_API_KEY');

// ❌ Fails silently at request time
this.apiKey = process.env.ANTHROPIC_API_KEY;
```

---

## Error Handling

Catch all errors from the API call in a single `try/catch`. Throw `InternalServerErrorException` with the exact user-facing message from the spec. The global `HttpExceptionFilter` converts this to `{ success: false, error: '...' }`.

```ts
// ✅ Correct — one catch, consistent message
try {
  const response = await firstValueFrom(this.httpService.post(...));
  return this.parseSections(response.data.content[0].text);
} catch {
  throw new InternalServerErrorException(
    'Report generation failed. Please try again.',
  );
}

// ❌ Don't leak Anthropic error details to the client
} catch (error) {
  throw new InternalServerErrorException(error.message);
}

// ❌ Don't swallow the error
} catch {
  return null;
}
```

`firstValueFrom` throws if the Observable errors — network failure, 4xx, or 5xx from Anthropic are all caught by the same block.

---

## Mocking in Playwright Tests

`ANTHROPIC_API_URL` is read from env, so tests point `ClaudeService` at a local mock server instead of the real API. Never call the real Anthropic API in tests.

```ts
// test/global-setup.ts
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

const MOCK_PORT = 4001;
const APP_PORT  = 3001;

export default async function globalSetup() {
  // 1. Start mock Anthropic server
  const mockServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      content: [{
        type: 'text',
        text: [
          'HEADLINE SUMMARY',
          'You are taking a courageous step by addressing this situation head-on.',
          '',
          'KEY PRIORITIES',
          'Immediate Safety & Urgency requires your attention first.',
          '',
          'WHAT TO AVOID',
          'Avoid issuing ultimatums without a follow-through plan.',
          '',
          'NEXT 7 DAYS ACTION PLAN',
          'Days 1–2: Have a calm, private conversation with your child.',
          '',
          'ENCOURAGEMENT & DIRECTION',
          'You are not alone. Many parents have walked this path successfully.',
        ].join('\n'),
      }],
    }));
  });

  await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, resolve));
  (global as any).__MOCK_SERVER__ = mockServer;

  // 2. Start NestJS app pointing at the mock
  const appProcess = spawn(
    'npx', ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT:                String(APP_PORT),
        API_SECRET_KEY:      'test-secret',
        ANTHROPIC_API_KEY:   'mock-key',
        ANTHROPIC_API_URL:   `http://localhost:${MOCK_PORT}`,
      },
      stdio: 'pipe',
    },
  );

  await new Promise<void>((resolve, reject) => {
    appProcess.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Nest application successfully started')) resolve();
    });
    appProcess.on('error', reject);
    setTimeout(() => reject(new Error('App did not start within 15s')), 15000);
  });

  (global as any).__APP_PROCESS__ = appProcess;
}
```

```ts
// test/global-teardown.ts
export default async function globalTeardown() {
  (global as any).__APP_PROCESS__?.kill();
  await new Promise<void>((resolve) =>
    (global as any).__MOCK_SERVER__?.close(resolve),
  );
}
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  globalSetup:    './test/global-setup.ts',
  globalTeardown: './test/global-teardown.ts',
  use: { baseURL: `http://localhost:3001` },
  timeout: 30000,
});
```

To test the Claude failure path, run a second app instance in that test with `ANTHROPIC_API_URL` pointing at a mock that returns 500:

```ts
// test/api.spec.ts — Claude failure test
test('returns 500 when Claude API fails', async () => {
  // Spin a one-off mock that always errors
  const errorServer = http.createServer((_req, res) => {
    res.writeHead(500);
    res.end(JSON.stringify({ error: { message: 'upstream error' } }));
  });
  await new Promise<void>((r) => errorServer.listen(4002, r));

  const failApp = spawn(
    'npx', ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT: '3002',
        API_SECRET_KEY:    'test-secret',
        ANTHROPIC_API_KEY: 'mock-key',
        ANTHROPIC_API_URL: 'http://localhost:4002',
      },
      stdio: 'pipe',
    },
  );

  await new Promise<void>((resolve) => {
    failApp.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Nest application successfully started')) resolve();
    });
  });

  const res = await fetch('http://localhost:3002/api/report/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-secret' },
    body: JSON.stringify({ responses: Array(24).fill(2) }),
  });

  const body = await res.json();
  expect(res.status).toBe(500);
  expect(body).toEqual({ success: false, error: 'Report generation failed. Please try again.' });

  failApp.kill();
  await new Promise<void>((r) => errorServer.close(r));
});
```

---

## Anti-Patterns

```ts
// ❌ Reading API key from process.env directly in a service
headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY }

// ❌ Using .subscribe() — the return value inside subscribe is discarded
this.httpService.post(...).subscribe(response => {
  return this.parseSections(response.data.content[0].text); // does nothing
});

// ❌ Awaiting the Observable directly — it is not a Promise
const response = await this.httpService.post(...);

// ❌ Installing @anthropic-ai/sdk — this project uses raw HttpService
import Anthropic from '@anthropic-ai/sdk';

// ❌ Hardcoding the model string outside claude.service.ts
const model = 'claude-3-sonnet'; // wrong model name, wrong location

// ❌ Leaking Anthropic error details in the 500 response
throw new InternalServerErrorException(error.message);
```
