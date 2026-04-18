# Parent Action Plan System — Product Specification (NestJS)

> **Version:** 1.0
> **Status:** Ready for Development
> **Scope:** Standalone API — MVP
> **Platform:** Circle (frontend) + NestJS REST API (backend)
> **AI Model:** claude-sonnet-4-20250514 via Anthropic API
> **Runtime:** Node.js + NestJS + TypeScript

---

## 1. What We're Building

A NestJS backend API that accepts structured questionnaire responses from parents concerned about adolescent substance use, scores and maps those responses into concern domains, and generates a personalised, section-based action plan using the Claude AI API.

The system has three core parts:

1. **Input validation** — accept 24 questionnaire responses (scored 1–4), enforced via NestJS class-validator DTOs
   2. **Scoring engine** — calculate domain averages, identify top 3 priority areas
   3. **Report generation** — inject structured inputs into a defined prompt, call Claude, return a formatted 5-section action plan

The front-end is built on **Circle** and is not part of this scope. This spec covers the NestJS API only.

---

## 2. What This Is Not

- Not a machine learning or model-training project
  - No user auth, sessions, guards beyond the API key header check
  - No database, ORM, or persistent storage of any kind
  - No complex multi-step agentic workflow
  - No PDF generation, email delivery, or file uploads

> **Core principle:** The system design, prompts, and logic are fully defined. Implement them cleanly using NestJS conventions — do not over-engineer or deviate from the spec.

---

## 3. Questionnaire

### 3.1 Scoring Scale

All 24 questions are answered on a 1–4 integer scale:

| Score | Label | Interpretation |
|---|---|---|
| 1 | Strong / Healthy | Positive indicator, low concern |
| 2 | Moderate | Some concern, worth monitoring |
| 3 | Elevated | Significant concern, action recommended |
| 4 | Concerning | High urgency, immediate attention needed |

Higher score = greater concern.

### 3.2 Full Question Set

| # | Question | Domain |
|---|---|---|
| Q1 | How certain are you that your child has used drugs, alcohol, or other substances? | Safety & Urgency |
| Q2 | How frequently do you suspect substance use may be occurring? | Safety & Urgency |
| Q3 | Have you observed secrecy, lying, or avoidance when discussing concerns? | Communication |
| Q4 | How often does your child spend time in environments where substances may be present? | Support |
| Q5 | How intense are conflicts between you and your child regarding behavior or rules? | Communication |
| Q6 | How confident do you feel confronting your child about substance concerns? | Communication |
| Q7 | How consistent are consequences when rules are broken? | Boundaries |
| Q8 | How often do you feel unsure whether you are overreacting or underreacting? | Support |
| Q9 | Have you noticed significant mood swings, withdrawal, or aggressive behavior? | Communication |
| Q10 | How concerned are you about your child's safety (driving, risky environments, etc.)? | Safety & Urgency |
| Q11 | How aligned are caregivers or co-parents in responding to the situation? | Boundaries |
| Q12 | How often does your child spend time with peers you consider a negative influence? | Support |
| Q13 | How comfortable is your child discussing stress, anxiety, or emotional pain? | Communication |
| Q14 | How frequently do you monitor your child's whereabouts and activities? | Household |
| Q15 | How supported do you feel by school staff or community professionals? | Support |
| Q16 | Have you sought guidance from a therapist, counselor, or treatment provider? | Support |
| Q17 | How often do you feel exhausted, fearful, or overwhelmed by the situation? | Support |
| Q18 | How clear is your plan for next steps if substance use continues? | Boundaries |
| Q19 | How often does your child accept responsibility for their behavior? | Boundaries |
| Q20 | How much structure currently exists in your child's daily routine? | Household |
| Q21 | How confident are you that your home environment discourages substance use? | Household |
| Q22 | How prepared do you feel to set firm but supportive boundaries? | Household |
| Q23 | How frequently do you worry about long-term consequences if patterns continue? | Safety & Urgency |
| Q24 | How ready are you to take decisive action to protect your child's well-being? | Safety & Urgency |

---

## 4. Domain Mapping

| Domain | Description | Questions |
|---|---|---|
| Immediate Safety & Urgency | Parent's perceived risk level and urgency | Q1, Q2, Q10, Q23, Q24 |
| Household Structure | Stability, routine, and environmental safety of the home | Q14, Q20, Q21, Q22, Q18 |
| Boundary Consistency | How clearly and consistently rules and consequences are enforced | Q7, Q11, Q18, Q19, Q22 |
| Communication & Conflict | Quality of parent-child communication and household tension | Q3, Q5, Q6, Q9, Q13 |
| Support & Professional Engagement | Access to and use of professional/community resources | Q15, Q16, Q17, Q8, Q12 |

> Q18 and Q22 appear in both Household Structure and Boundary Consistency. This is intentional — they are shared signals for both domains.

---

## 5. Scoring Logic

### 5.1 Algorithm

```
1. Receive responses[] — array of 24 integers (1–4), index 0 = Q1
2. For each domain, extract scores of its assigned questions (0-based index)
3. domain_score = average(assigned_question_scores)
4. Rank all 5 domains by score descending
5. Select top 3 as topDomains[]
6. Pass all 5 scores + top 3 domain names into the prompt builder
```

### 5.2 Tie-Breaking

If two or more domains share the same score, rank in this fixed order:

1. Immediate Safety & Urgency
   2. Communication & Conflict
   3. Boundary Consistency
   4. Household Structure
   5. Support & Professional Engagement

### 5.3 Edge Cases

| Case | Handling |
|---|---|
| Missing response | Treat as 2 (moderate) |
| Value < 1 | Clamp to 1 |
| Value > 4 | Clamp to 4 |
| Non-integer value | Caught by DTO validation → 400 |
| Wrong array length | Caught by DTO validation → 400 |
| All domains equal | Apply tie-breaking order above |

---

## 6. Prompt Framework

### 6.1 System Prompt

> **Update (post-v1.0):** The original v1.0 system prompt has been superseded by stakeholder feedback (Matthew, ASAP). The current source of truth lives in `src/report/prompts/system.prompt.ts`. The new prompt is significantly longer and bakes in: (a) ASAP Community framing — the plan is a continuation of the program the parent already started, not a standalone report; (b) ASAP resource prioritization — Articles of Action → essential workshops (Effective Communication, Building a Support Network) → ~21 auxiliary workshops → ASAP-endorsed therapists/treatment centers → external resources only when higher-risk; (c) deeper, non-obvious intervention strategies in the top priorities and 72-hour plan (parent emotional regulation before engaging, caregiver alignment, building the support structure, understanding the specific substance); (d) a more grounded, real-world tone that names the parent's actual emotional load (exhaustion, fear, frustration) instead of polished generic empathy; (e) explicit personalization rules that require every recommendation to tie back to a behavior the parent reported.

Stored as a constant in `src/report/prompts/system.prompt.ts`. Treat the file as authoritative — when changing prompt text, edit the file directly and update this section to summarize the change.

### 6.2 User Prompt Template

Built at runtime in `src/report/prompts/user.prompt.ts` by injecting scores and top domains:

```
Domain Scores:
- Immediate Safety & Urgency: {score_1}
- Household Structure: {score_2}
- Boundary Consistency: {score_3}
- Communication & Conflict: {score_4}
- Support & Professional Engagement: {score_5}

Top 3 Priority Domains: {domain_1}, {domain_2}, {domain_3}

Generate a Parent Action Plan following the required output structure exactly.
```

Scores must be rounded to 2 decimal places before injection.

### 6.3 Required Output Structure

> **Update (post-v1.0):** The original 5-section structure has been replaced by a 7-section structure to support the ASAP framing and the deeper 72-hour intervention plan. The headers below are emitted verbatim by the model and parsed in `claude.service.ts`. Response keys in §7.4 / `ReportSections` follow this 7-section layout.

The AI must return exactly 7 sections with these fixed names:

| # | Section Name | Content |
|---|---|---|
| 1 | HEADLINE SUMMARY | 2–3 sentences. Names the parent's actual emotional load. Anchors them in the ASAP work. |
| 2 | TOP 3 IMMEDIATE PRIORITIES | 3 deeper, non-obvious strategies (parent emotional regulation, caregiver alignment, support structure, substance understanding). |
| 3 | KEY PRIORITIES | Top 3 domains. Each: plain-language meaning for this family / 2–3 specific steps with ASAP resource pointers / one thing to watch for. |
| 4 | WHAT TO AVOID | 3–5 specific mistakes, including at least one warning about emotional reactivity. |
| 5 | FIRST 72 HOURS PLAN | Day 1 / Day 2 / Day 3, sequenced bullets covering emotional regulation, caregiver coordination, support-structure building, substance learning, and decision guidance for predictable teen reactions. |
| 6 | DAYS 4 TO 7 CONTINUATION | 3–4 bullets pointing to specific ASAP next steps (workshops, Articles of Action chapters, when to escalate to a professional). |
| 7 | ENCOURAGEMENT AND DIRECTION | 2–3 grounded sentences. Names the determination/perseverance the work takes. Frames it as parent + child against the drugs. |

### 6.4 Content Rules

- Be specific — output must reflect the actual domain scores
  - No repetition across sections
  - No clinical jargon
  - Do not mention AI, questionnaires, or scoring in the output
  - Use the exact section names above — not "Section 1", not generic titles

---

## 7. API Specification

### 7.1 Endpoint

```
POST /api/report/generate
Content-Type: application/json
X-API-Key: <secret>
```

### 7.2 Request Body

```json
{
  "responses": [3, 2, 4, 1, 3, 2, 4, 3, 2, 3, 2, 3, 1, 2, 3, 2, 4, 3, 2, 1, 2, 3, 4, 3]
}
```

`responses` — array of exactly 24 integers, each between 1 and 4. Index 0 = Q1, index 23 = Q24.

### 7.3 Health Check

```
GET /api/health
```

Response `200`:

```json
{ "status": "ok" }
```

No API key required on this endpoint.

### 7.4 Success Response `200`

```json
{
  "success": true,
  "domainScores": {
    "Immediate Safety & Urgency": 3.2,
    "Household Structure": 2.4,
    "Boundary Consistency": 2.8,
    "Communication & Conflict": 3.0,
    "Support & Professional Engagement": 2.6
  },
  "topDomains": [
    "Immediate Safety & Urgency",
    "Communication & Conflict",
    "Boundary Consistency"
  ],
  "report": {
    "headlineSummary": "...",
    "topImmediatePriorities": "...",
    "keyPriorities": "...",
    "whatToAvoid": "...",
    "first72Hours": "...",
    "days4to7": "...",
    "encouragement": "..."
  }
}
```

> Note: response keys use camelCase to follow NestJS/TypeScript conventions.

### 7.5 Error Responses

| Status | Cause | Response |
|---|---|---|
| `400` | DTO validation failure | `{"success": false, "error": "responses must be an array of 24 integers between 1 and 4"}` |
| `401` | Missing or invalid `X-API-Key` | `{"success": false, "error": "Unauthorized"}` |
| `500` | Claude API failure | `{"success": false, "error": "Report generation failed. Please try again."}` |

All error responses use a consistent shape: `{ success: false, error: string }`. This is enforced by a global exception filter.

---

## 8. NestJS Architecture

### 8.1 Module Structure

```
src/
├── app.module.ts                   # Root module — imports all feature modules
├── main.ts                         # Bootstrap, global pipes, CORS, prefix
├── common/
│   ├── guards/
│   │   └── api-key.guard.ts        # Reads X-API-Key, compares to API_SECRET_KEY env var
│   └── filters/
│       └── http-exception.filter.ts  # Global filter — normalises all errors to {success, error}
├── health/
│   ├── health.module.ts
│   └── health.controller.ts        # GET /api/health → { status: 'ok' }
└── report/
    ├── report.module.ts
    ├── report.controller.ts        # POST /api/report/generate — applies ApiKeyGuard
    ├── report.service.ts           # Orchestrates scoring → prompt → Claude → response
    ├── dto/
    │   └── generate-report.dto.ts  # class-validator DTO for request body
    ├── scoring/
    │   ├── domain.map.ts           # DOMAIN_MAP constant (domain → question indices)
    │   └── scoring.service.ts      # Injectable service — calculateScores()
    ├── prompts/
    │   ├── system.prompt.ts        # SYSTEM_PROMPT constant
    │   └── user.prompt.ts          # buildUserPrompt() function
    └── claude/
        └── claude.service.ts       # Injectable service — generateReport()
```

### 8.2 Key Implementation Details

**`main.ts`**
- Global prefix: `/api`
  - Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
  - Global `HttpExceptionFilter`
  - CORS: allow `ALLOWED_ORIGIN` env var (fallback `*` for local)

**`generate-report.dto.ts`**
```ts
import { IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max } from 'class-validator';

export class GenerateReportDto {
  @IsArray()
  @ArrayMinSize(24)
  @ArrayMaxSize(24)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4, { each: true })
  responses: number[];
}
```

When validation fails, the global pipe throws a `BadRequestException`. The global filter catches it and returns `{ success: false, error: "responses must be an array of 24 integers between 1 and 4" }`.

**`api-key.guard.ts`**
- Implements `CanActivate`
  - Reads `request.headers['x-api-key']`
  - Compares against `process.env.API_SECRET_KEY`
  - Throws `UnauthorizedException` if missing or incorrect
  - Applied via `@UseGuards(ApiKeyGuard)` on the report controller only — not on health

**`domain.map.ts`**
```ts
export const DOMAIN_MAP: Record<string, number[]> = {
  'Immediate Safety & Urgency':        [0, 1, 9, 22, 23],
  'Household Structure':               [13, 19, 20, 21, 17],
  'Boundary Consistency':              [6, 10, 17, 18, 21],
  'Communication & Conflict':          [2, 4, 5, 8, 12],
  'Support & Professional Engagement': [14, 15, 16, 7, 11],
};

export const TIE_BREAK_ORDER = [
  'Immediate Safety & Urgency',
  'Communication & Conflict',
  'Boundary Consistency',
  'Household Structure',
  'Support & Professional Engagement',
];
```

**`scoring.service.ts`**
- `@Injectable()`
  - `calculateScores(responses: number[]): { domainScores: Record<string, number>; topDomains: string[] }`
  - Clamps values to [1, 4], fills missing with 2
  - Averages each domain, rounds to 2 decimal places
  - Sorts using `TIE_BREAK_ORDER` for stable ranking
  - Returns top 3 as `topDomains`

**`claude.service.ts`**
- `@Injectable()`
  - Uses `HttpService` (from `@nestjs/axios`) to call `https://api.anthropic.com/v1/messages`
  - Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
  - Model: `claude-sonnet-4-20250514`, `max_tokens: 2000`
  - Parses the response text to extract the 5 sections by their fixed names
  - Returns `ReportSections` typed object
  - On failure, throws `InternalServerErrorException` with the user-facing message

**`report.service.ts`**
- Injects `ScoringService` and `ClaudeService`
  - Calls `calculateScores` → `buildUserPrompt` → `generateReport`
  - Returns the full response shape

**`report.controller.ts`**
- `@UseGuards(ApiKeyGuard)`
  - `@Post('generate')`
  - Returns `{ success: true, domainScores, topDomains, report }`

### 8.3 TypeScript Interfaces

```ts
// src/report/interfaces/report.interface.ts

export interface DomainScores {
  'Immediate Safety & Urgency': number;
  'Household Structure': number;
  'Boundary Consistency': number;
  'Communication & Conflict': number;
  'Support & Professional Engagement': number;
}

export interface ReportSections {
  headlineSummary: string;
  topImmediatePriorities: string;
  keyPriorities: string;
  whatToAvoid: string;
  first72Hours: string;
  days4to7: string;
  encouragement: string;
}

export interface GenerateReportResponse {
  success: true;
  domainScores: DomainScores;
  topDomains: string[];
  report: ReportSections;
}
```

### 8.4 Environment Variables

```
ANTHROPIC_API_KEY     — Claude API authentication key
API_SECRET_KEY        — Internal key for X-API-Key header validation
ALLOWED_ORIGIN        — CORS whitelist (Circle front-end domain)
PORT                  — Server port (default: 3000)
```

### 8.5 Request Flow

```
Circle → POST /api/report/generate
  → ApiKeyGuard (401 if invalid)
  → ValidationPipe on GenerateReportDto (400 if invalid)
  → ReportController.generate()
  → ReportService.generate()
      → ScoringService.calculateScores()
      → buildUserPrompt()
      → ClaudeService.generateReport()
  → Return 200 with GenerateReportResponse
  → On Claude failure → HttpExceptionFilter → 500
```

---

## 9. Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10",
    "@nestjs/core": "^10",
    "@nestjs/platform-express": "^10",
    "@nestjs/axios": "^3",
    "axios": "^1",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "reflect-metadata": "^0.2",
    "rxjs": "^7"
  },
  "devDependencies": {
    "@nestjs/cli": "^10",
    "@nestjs/testing": "^10",
    "@playwright/test": "^1.44",
    "@types/node": "^20",
    "typescript": "^5",
    "ts-node": "^10",
    "nodemon": "^3"
  }
}
```

---

## 10. Implementation Phases

| Phase | Scope | Details |
|---|---|---|
| 1 | Project Setup | `nest new`, configure global prefix `/api`, ValidationPipe, CORS, HttpExceptionFilter, `/api/health` |
| 2 | DTO + Validation | `GenerateReportDto` with class-validator decorators. Verify all invalid inputs return 400. |
| 3 | API Key Guard | `ApiKeyGuard` implementing `CanActivate`. Apply to report controller only. Verify 401 behaviour. |
| 4 | Scoring Service | `ScoringService` with `DOMAIN_MAP`, clamping, averaging, tie-breaking. Unit test independently. |
| 5 | Prompt Builder | `SYSTEM_PROMPT` constant + `buildUserPrompt()` function. Unit test output string. |
| 6 | Claude Service | `ClaudeService` using `HttpService`. Parse 5 sections from AI response. Handle API failures. |
| 7 | Report Service + Controller | Wire `ScoringService` + `ClaudeService` through `ReportService`. Return typed response. |
| 8 | Playwright Tests | Full test suite against all acceptance criteria. Mock Claude API. All tests pass. |

---

## 11. Acceptance Criteria

### Functional
- `POST /api/report/generate` with valid 24-item `responses` returns `200` with all 5 report sections
  - All 5 domain scores are calculated correctly per the domain map
  - Top 3 domains are correctly ranked with tie-breaking applied
  - `GET /api/health` returns `200 { "status": "ok" }` without an API key

### Validation
- Array with fewer than 24 items → `400`
  - Array with more than 24 items → `400`
  - Any value outside 1–4 → `400`
  - Float value (e.g. `2.5`) → `400`
  - String value (e.g. `"3"`) → `400`
  - Missing `responses` key → `400`
  - All 400 responses use shape `{ success: false, error: string }`

### Auth
- Missing `X-API-Key` header → `401`
  - Wrong `X-API-Key` value → `401`
  - Correct `X-API-Key` → proceeds past guard

### Reliability
- Claude API failure → `500 { "success": false, "error": "Report generation failed. Please try again." }`
  - Server does not crash on any malformed input
  - Response time under 15 seconds under normal conditions

### Delivery
- Source code in a GitHub repository
  - `README.md` includes: prerequisites, setup, env vars, `npm run start:dev`, sample `curl`
  - All Playwright tests pass with `npm test`

---

## 12. Out of Scope (v1)

- Database, ORM, or any persistence layer
  - JWT or session-based authentication
  - Rate limiting
  - Multiple language support
  - PDF or email output
  - Admin dashboard or UI
  - Caching
  - Streaming responses

---

## 13. Playwright Test Coverage

Tests live in `test/api.spec.ts`. The server is started before the suite and stopped after using Playwright's `globalSetup` / `globalTeardown`. The Claude API is mocked — no real API calls in tests.

### Health
- `GET /api/health` → `200 { status: 'ok' }`

### Auth
- No `X-API-Key` → `401`
  - Wrong `X-API-Key` → `401`
  - Correct `X-API-Key` with invalid body → `400` (not `401` — guard passes, DTO fails)

### Validation (all → `400`)
- Missing `responses` key
  - `responses` is not an array
  - `responses` has 23 items
  - `responses` has 25 items
  - `responses` contains `2.5` (float)
  - `responses` contains `"3"` (string)
  - `responses` contains `0`
  - `responses` contains `5`
  - `responses` is an empty array

### Scoring (verified via response body)
- Sample input from Section 14: assert `domainScores['Immediate Safety & Urgency']` ≈ `3.6` (±0.05)
  - Sample input: assert `topDomains[0]` === `'Immediate Safety & Urgency'`
  - Sample input: assert `topDomains.length` === `3`
  - All-equal input (24 × `2`): assert `topDomains[0]` === `'Immediate Safety & Urgency'` (tie-break)

### Response Shape (on valid request with mocked Claude)
- `success` === `true`
  - `domainScores` has exactly 5 keys matching domain names from Section 4
  - Each domain score is a number between 1 and 4
  - `topDomains` is an array of exactly 3 strings
  - `report` has exactly these keys: `headlineSummary`, `keyPriorities`, `whatToAvoid`, `next7Days`, `encouragement`
  - All 5 report values are non-empty strings

### Failure Handling
- Mock Claude returns 500 → assert endpoint returns `500 { success: false, error: 'Report generation failed. Please try again.' }`

---

## 14. Sample Test Input

```bash
curl -X POST https://your-api.com/api/report/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "responses": [4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3]
  }'
```

**Expected domain scores (approximate):**

| Domain | Score | Priority |
|---|---|---|
| Immediate Safety & Urgency | 3.6 | #1 |
| Communication & Conflict | 3.0 | #2 |
| Support & Professional Engagement | 3.0 | #3 |
| Boundary Consistency | 2.2 | — |
| Household Structure | 2.0 | — |

**Expected top 3:** `Immediate Safety & Urgency`, `Communication & Conflict`, `Support & Professional Engagement`
