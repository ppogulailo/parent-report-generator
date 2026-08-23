# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NestJS REST API that scores a 24-question parent questionnaire, maps responses to 5 concern domains, and generates a personalised action plan. A Next.js frontend in `frontend/` consumes the API.

**Two pipelines exist right now, deliberately and temporarily.**

- **Version 1.0** (`POST /api/assessment/submit`) — the methodology lives in `content/` as data, routing is decided in `src/selection/` before the model is called, and the model's output is schema-validated against that decision. This is the one to change.
- **The pre-existing path** (`POST /api/report/generate`) — the methodology lives inside a 307-line prompt and the model is asked to follow it. Still serving the live questionnaire at `/[lang]` while V1 is reviewed at `/[lang]/v1`. Slated for deletion; see `LAUNCH-READINESS.md`.

Do not add features to the old path.

**Source of truth for Version 1.0:** [`RECOMMENDATION-MATRIX.md`](./RECOMMENDATION-MATRIX.md) and `content/`. The matrix document is what the client approves; `content/` is what the code executes. They must agree.

**Source of truth for the old path:** [`SPEC.md`](./SPEC.md).

## The rule that governs Version 1.0

**The matrix selects. The model writes.**

Selection happens in deterministic TypeScript (`src/selection/`) evaluating condition trees held as JSON in `content/recommendation-matrix.json`. The model receives the already-chosen recommendations and workshops and writes prose around them. It never chooses.

This is enforced, not requested. `src/generation/report-schema.ts` builds a Zod schema from the selected ids, and a response whose ids do not match exactly fails validation and is retried with the error fed back. **If you are tempted to let the model pick something, or to move a selection decision into a prompt, stop — that inverts the whole architecture.**

**Out of scope:** no database, no auth beyond the `X-API-Key` header, no PDF/email, no caching. Stored plans, PDF and email are Milestone 2.

## Architecture

```
src/
├── main.ts                         # /api global prefix, ValidationPipe, HttpExceptionFilter, CORS
├── app.module.ts
├── common/                         # ApiKeyGuard, HttpExceptionFilter
├── health/                         # GET /api/health (no guard)
│
│   ── Version 1.0 ──
├── content/                        # loads + validates content/, fails boot on a bad rule
│   ├── content.loader.ts           #   JSON + prompt templates, `_`-prefixed keys stripped
│   ├── content.validate.ts         #   cross-file checks; problems are fatal, warnings are not
│   └── schemas/                    #   Zod, all .strict()
├── selection/                      # THE MATRIX. Deterministic. No model involved.
│   ├── scoring.service.ts          #   faithful port of the live arithmetic
│   ├── rule.evaluator.ts           #   the only thing that interprets a condition tree
│   └── selection.service.ts        #   tier → rules → tier gating → primary + supporting
├── generation/                     # prompt → validate → retry → assemble
│   ├── report-schema.ts            #   ids must equal the selection exactly
│   ├── voice-rules.ts              #   required wording checked against the prose
│   └── prompt.builder.ts           #   fills placeholders; contains no prompt text
├── assessment/                     # POST /api/assessment/submit, GET questionnaire|capabilities
│
│   ── the old path, slated for deletion ──
└── report/                         # POST /api/report/generate, prompts/, scoring/

content/                            # the methodology, as data
├── assessment.json                 # 24 scored questions + the non-scored gate
├── recommendation-matrix.json      # tiers, routing rules, tier gates
├── workshops.json                  # the resource library, wording rules, banned titles
└── report-templates/               # sections.json + the four prompt templates
```

V1 request flow: `ApiKeyGuard → ValidationPipe → AssessmentValidator → ScoringService → SelectionService → PromptBuilder → LlmClient → schema + wording checks → assemble → response`.

Old flow: `ApiKeyGuard → ValidationPipe → ReportController → ReportService → ScoringService → buildUserPrompt → ClaudeService → response`.

`frontend/` is a Next.js 15 / React 19 app (default port 3100) under `app/[lang]/` with i18n via `app/i18n.ts` and questionnaire content in `app/questions.ts`. It calls the Nest backend through `app/api/`.

## Skills — read before touching the relevant areas

- `.claude/skills/anthropic-api-integration/SKILL.md` — canonical `ClaudeService`, request/response shape, headers, section parser, `ConfigService.getOrThrow`, error handling. **Do not install `@anthropic-ai/sdk`** — this project uses raw `HttpService`.
- `.claude/skills/playwright-api-testing/SKILL.md` — `globalSetup`/`globalTeardown`, mock Anthropic server, app bootstrap pattern, full endpoint assertion patterns. Never hit the real Anthropic API in tests.
- `.claude/skills/error-response-shape/SKILL.md` — global filter shape `{ success: false, error: string }` and the exact error messages per status.

## Conventions

- Response keys are camelCase (`domainScores`, `topDomains`, `headlineSummary`, etc.) even though the domain *names* inside `domainScores` are the human-readable strings from the spec.
- **No prompt text in application code on the V1 path.** It all lives in `content/report-templates/`. `PromptBuilder` only fills placeholders, and a template using one the builder cannot fill fails at boot.
- **Content is data.** Adding a section, a question, a routing rule or a tier is a JSON edit. If you find yourself adding a code branch for a content change, the schema is probably wrong.
- **Zod schemas are `.strict()`.** A misspelled key must fail at boot. `"gtee": 3` silently ignored would be a rule that never fires — worse than a crash, because nobody notices a family quietly not receiving a recommendation. `_`-prefixed keys are comments and are stripped before validation.
- **Answers are keyed by question id on the V1 path**, never by array position. The old path uses a positional array, which silently re-maps stored answers when the questionnaire is reordered.
- `SYSTEM_PROMPT` in `src/report/prompts/system.prompt.ts` governs the **old** path only.
- The model is `gpt-5.1` on both paths, configurable via `OPENAI_MODEL`, and lives only in `llm.client.ts` (V1) / `claude.service.ts` (old). **`ClaudeService` is named for Anthropic but posts to OpenAI** — do not reintroduce that name.
- Read secrets via `ConfigService.getOrThrow` — fail fast at boot, not at first request.
- `OPENAI_API_URL` is overridable via env so tests can point at the mock.
- Scoring: clamp values to [1,4], fill missing with 2, round domain averages to 2 decimals, break ties using the order in `content/assessment.json` → `tieBreakOrder` (V1) or `TIE_BREAK_ORDER` from SPEC §5.2 (old path). The two are the same order.

## Things that will bite you

- **`tier.toneGuidance` is an instruction to the model. `tier.description` is what a parent reads.** Never render `toneGuidance`.
- **Workshop titles and discussion group names are cited verbatim and never translated**, including in Spanish reports. Same for the two sentences of the professional-help sequence.
- **The wording checker must only read prose.** Workshop ids contain "professional" and "search"; walking them made every report look like a violation.
- **Required wording is exempt from the unselected-resource check.** The professional-help sequence names the Sustaining Recovery discussion group, which the matrix routes to nobody — without the exemption the two rules contradict and no response can pass.
- **`overallAverage` is deliberately not rounded** while each domain average is rounded to 2dp. The severity gate compares it against 2.75 and 2.0, and rounding first moves a family across a tier boundary at exactly 2.745.
- **Domains overlap.** q18 and q22 each count toward two, so `questionIds` lives on the domain rather than a `domainId` on the question. q04 belongs to no domain at all. Both are the approved behaviour and are flagged for the founder, not "fixed".
- **The scale midpoint fill uses `Math.floor`, not `Math.round`.** On a 1–4 scale, rounding 2.5 up to 3 makes an unanswered question lean toward concern.
- **Every `NEXT_PUBLIC_*` needs BOTH a `[build.args]` entry in `frontend/fly.toml` and an `ARG` line in `frontend/Dockerfile`.** A build arg with no `ARG` to receive it is silently dropped. They are inlined at build time, so changing one needs `--no-cache`.
- **The frontend health check must be `/api/health`, not `/`.** The root redirects to `/en`, and a redirect fails Fly's check. This was a real outage.

## Environment variables

`OPENAI_API_KEY`, `API_SECRET_KEY`, `ALLOWED_ORIGIN`, `PORT` (default 3000), `OPENAI_API_URL` and `OPENAI_MODEL` (overridable), `CONTENT_DIR` (test override only).

## Commands

```bash
npm run start:dev                    # nodemon + ts-node, watches src/
npm run build                        # nest build
npm run lint                         # eslint --fix
npm run test                         # playwright test (api.spec, language.spec, stability.spec)
npm run test:unit                    # 59 unit tests, no server, no network
npm run test:v1                      # 25 API tests: real HTTP + content, mock model
npm run test:v1:ui                   # 8 browser tests; starts mock + API + frontend itself
npm run content:validate             # cross-file content validation
npm run content:generate             # regenerate assessment.json + workshops.json from the approved sources
npm run baseline:capture             # capture the eight baseline plans (needs API_SECRET_KEY)
npx playwright test <pattern>        # single file/grep, e.g. npx playwright test api.spec.ts -g "health"
npx playwright test --config=playwright.ui.config.ts   # UI suite under test/ui (needs frontend on :3100)
```

`playwright.config.ts` boots the Nest app + a mock server via `test/global-setup.ts` and forces `workers: 1` (the mock records the last request, so tests must run serially). It covers the **old** endpoint.

The V1 suites are separate and self-contained. `playwright.v1.config.ts` and `playwright.v1ui.config.ts` share `test/v1/global-setup.ts`, which starts a mock model on 4599 and the API on 3401; the UI config additionally starts Next on 3402 via `webServer`. Both are `workers: 1` because the mock holds one mode at a time.

**The V1 mock parses the prompt rather than returning a canned body** — the response schema is built per request from the selection, so a fixed reply would fail validation for reasons unrelated to the test. Set failure modes over HTTP: `POST http://localhost:4599/_mode/<mode>` (see `test/v1/mock-llm.ts`).

`playwright.ui.config.ts` drives an already-running frontend and covers the old flow only.

Frontend dev: `cd frontend && npm run dev` (port 3100). Deployment notes (Fly.io + Dockerfile) live in `DEPLOY.md` / `fly.toml`.