# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NestJS REST API that scores a 24-question parent questionnaire, maps responses to 5 concern domains, and generates a 7-section Parent Action Plan via the Anthropic Claude API. A Next.js frontend in `frontend/` consumes the API.

**Source of truth:** [`SPEC.md`](./SPEC.md). Read it before writing code. It defines the domain map, scoring algorithm, tie-break order, prompt text, response shape, error messages, and test coverage. Do not paraphrase or deviate from values defined there (domain names, section names, error strings, `SYSTEM_PROMPT`).

**Out of scope:** no database, no auth beyond the `X-API-Key` header, no PDF/email, no streaming, no caching.

## Architecture

```
src/
├── main.ts                         # /api global prefix, ValidationPipe, HttpExceptionFilter, CORS
├── app.module.ts
├── common/
│   ├── guards/api-key.guard.ts     # X-API-Key vs API_SECRET_KEY
│   └── filters/http-exception.filter.ts  # normalise all errors to { success: false, error }
├── health/                         # GET /api/health (no guard)
└── report/
    ├── report.module.ts
    ├── report.controller.ts        # POST /api/report/generate, @UseGuards(ApiKeyGuard)
    ├── report.service.ts           # scoring → prompt → Claude
    ├── dto/generate-report.dto.ts  # class-validator: 24 ints, 1–4
    ├── validation/                 # extra request-shape checks beyond class-validator
    ├── scoring/{domain.map,scoring.service}.ts
    ├── prompts/{system,user}.prompt.ts
    ├── claude/claude.service.ts    # HttpService → Anthropic /v1/messages
    └── interfaces/report.interface.ts
```

Request flow: `ApiKeyGuard → ValidationPipe → ReportController → ReportService → ScoringService → buildUserPrompt → ClaudeService → response`.

`frontend/` is a Next.js 15 / React 19 app (default port 3100) under `app/[lang]/` with i18n via `app/i18n.ts` and questionnaire content in `app/questions.ts`. It calls the Nest backend through `app/api/`.

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
npm run start:dev                    # nodemon + ts-node, watches src/
npm run build                        # nest build
npm run lint                         # eslint --fix
npm run test                         # playwright test (api.spec, language.spec, stability.spec)
npx playwright test <pattern>        # single file/grep, e.g. npx playwright test api.spec.ts -g "health"
npx playwright test --config=playwright.ui.config.ts   # UI suite under test/ui (needs frontend on :3100)
```

`playwright.config.ts` boots the Nest app + a mock Anthropic server via `test/global-setup.ts` and forces `workers: 1` (the mock records the last request, so tests must run serially). The UI config is separate — it does NOT spawn the backend or the mock and only drives an already-running frontend.

Frontend dev: `cd frontend && npm run dev` (port 3100). Deployment notes (Fly.io + Dockerfile) live in `DEPLOY.md` / `fly.toml`.