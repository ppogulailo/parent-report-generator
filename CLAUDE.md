# CLAUDE.md

## Project

NestJS REST API that scores a 24-question parent questionnaire, maps responses to 5 concern domains, and generates a 5-section Parent Action Plan via the Anthropic Claude API.

**Source of truth:** [`SPEC.md`](./SPEC.md). Read it before writing code. It defines the domain map, scoring algorithm, tie-break order, prompt text, response shape, error messages, and test coverage. Do not paraphrase or deviate from values defined there (domain names, section names, error strings, `SYSTEM_PROMPT`).

**Out of scope:** no database, no auth beyond the `X-API-Key` header, no PDF/email, no streaming, no caching.

## Architecture

Target layout (currently only the Nest starter exists — build it out to match):

```
src/
├── main.ts                         # /api global prefix, ValidationPipe, HttpExceptionFilter, CORS
├── app.module.ts
├── common/
│   ├── guards/api-key.guard.ts     # X-API-Key vs API_SECRET_KEY
│   └── filters/http-exception.filter.ts  # normalise all errors to { success: false, error }
├── health/                         # GET /api/health (no guard)
└── report/
    ├── report.controller.ts        # POST /api/report/generate, @UseGuards(ApiKeyGuard)
    ├── report.service.ts           # scoring → prompt → Claude
    ├── dto/generate-report.dto.ts  # class-validator: 24 ints, 1–4
    ├── scoring/{domain.map,scoring.service}.ts
    ├── prompts/{system,user}.prompt.ts
    ├── claude/claude.service.ts    # HttpService → Anthropic /v1/messages
    └── interfaces/report.interface.ts
```

Request flow: `ApiKeyGuard → ValidationPipe → ReportController → ReportService → ScoringService → buildUserPrompt → ClaudeService → response`.

## Skills — read before touching the relevant areas

- `.claude/skills/anthropic-api-integration/SKILL.md` — canonical `ClaudeService`, request/response shape, headers, section parser, `ConfigService.getOrThrow`, error handling. **Do not install `@anthropic-ai/sdk`** — this project uses raw `HttpService`.
- `.claude/skills/playwright-api-testing/SKILL.md` — `globalSetup`/`globalTeardown`, mock Anthropic server, app bootstrap pattern, full endpoint assertion patterns. Never hit the real Anthropic API in tests.
- `.claude/skills/error-response-shape/SKILL.md` — global filter shape `{ success: false, error: string }` and the exact error messages per status.

## Conventions

- Response keys are camelCase (`domainScores`, `topDomains`, `headlineSummary`, etc.) even though the domain *names* inside `domainScores` are the human-readable strings from the spec.
- `SYSTEM_PROMPT` is the source of truth in `src/report/prompts/system.prompt.ts` (the post-v1.0 prompt baked in ASAP framing, resource prioritization, and a 7-section structure). When changing it, update SPEC §6.1's summary at the same time.
- Model string `claude-sonnet-4-20250514` lives only in `claude.service.ts`.
- Read secrets via `ConfigService.getOrThrow` — fail fast at boot, not at first request.
- `ANTHROPIC_API_URL` is overridable via env so tests can point at the mock.
- Scoring: clamp values to [1,4], fill missing with 2, round domain averages to 2 decimals, break ties using `TIE_BREAK_ORDER` from SPEC §5.2.

## Environment variables

`ANTHROPIC_API_KEY`, `API_SECRET_KEY`, `ALLOWED_ORIGIN`, `PORT` (default 3000), `ANTHROPIC_API_URL` (test override only).

## Commands

```bash
npm run start:dev     # watch mode
npm run build         # nest build
npm run lint          # eslint --fix
npm run test          # jest unit tests (scoring, prompt builder)
npm run test:e2e      # jest e2e (starter config — Playwright suite lives in test/ per SPEC §13)
```

Playwright is the test runner named in SPEC §13 and in the skills; the current `package.json` only has Jest. Add `@playwright/test` + a `playwright.config.ts` when building out Phase 8.