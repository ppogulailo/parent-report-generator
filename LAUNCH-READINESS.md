# Launch readiness — Monitoring & Intervention Version 1.0

What is done, what is blocked and on whom, and the exact steps to launch at
`monitoring.asapcommunity.org`.

Every remaining item is either a content drop from ASAP, a decision, or a switch
flipped deliberately. Nothing on this page needs new development.

---

## Done

| Item | Where |
|---|---|
| Methodology transcribed into a reviewable matrix | `RECOMMENDATION-MATRIX.md`, `content/recommendation-matrix.json` |
| Severity logic proven identical to the live system | `test/unit/severity-parity.unit.spec.ts` — 30,000 submissions |
| Routing moved out of prompt instructions into application logic | `src/selection/` |
| Required recommendations and workshops cannot be omitted or invented | `src/generation/report-schema.ts` — ids must equal the selection exactly |
| Required wording verified against the finished prose, not merely prompted | `src/generation/voice-rules.ts` |
| Universal Guiding Principles ship as fixed content the model never sees | `content/report-templates/sections.json`, `type: "static"` |
| Workshop links render, open safely, and survive printing | `frontend/app/[lang]/ReportView.tsx` |
| Workshop URLs must be `https://` | `src/content/schemas/workshops.schema.ts` |
| Transition to Sustaining Recovery, gated on a non-scored answer | `content/assessment.json` → `gates`, section `sustainingRecoveryTransition` |
| English/Spanish held in one record per string, both required at boot | `src/content/schemas/rule.schema.ts` → `localizedStringSchema` |
| Spanish strings listed for sign-off | `SPANISH-REVIEW.md` — 216 strings, generated from content |
| Prompts moved out of code into content | `content/report-templates/` |
| Banned vocabulary, empathy filler and softened referrals checked, not just prompted | `content/voice.json`, `src/generation/voice-rules.ts` |
| Answer labels cannot be quoted back at the parent | `checkAnswerLabels` |
| Baseline comparison runs offline, so it can gate CI | `scripts/compare-baseline.ts` |
| Switch-over is a build arg, and reversible | `frontend/app/site.ts` → `V1_IS_DEFAULT` |
| Site origin centralised so the hostname change is config, not code | `frontend/app/site.ts` |

| The endpoint, the guard, the validator and the retry loop tested over real HTTP | `test/v1/api.v1.spec.ts` — 25 tests against a mock model |
| A parent can complete the questionnaire and read a plan, in a browser | `test/v1/ui.v1ui.spec.ts` — 8 tests, self-contained stack |

**Test state:** 92 tests — 59 unit, 25 API, 8 browser. `npm run content:validate`
clean. `npm run build` and the frontend build both clean.

```bash
npm run test:unit     # pure engine; no server, no network
npm run test:v1       # real HTTP, real content, mock model
npm run test:v1:ui    # browser through the whole stack; starts everything itself
```

The API and browser suites both boot the app against a mock model that **reads
the prompt and answers it** — section keys, recommendation ids and workshop ids
all come back out of the text the prompt builder produced. A canned reply could
not work, because the schema is built per request from the selection. The useful
side effect is that if the prompt ever stops naming the selected ids, every one
of those 33 tests fails.

Failure modes are reachable on demand rather than waited for: the mock can invent
a workshop, omit a priority area, write a section the platform owns, return prose
instead of JSON, or violate a wording rule once and then comply. Those are the
paths a real model takes intermittently and unreproducibly.

---

## Blocked, and on whom

| # | Blocked on | What is needed | Effect until it lands |
|---|---|---|---|
| 1 | **Dave** | Approval of the transcribed matrix | Every report is provisional and the landing page says so. This is the one blocker that gates the rest. |
| 2 | **ASAP** | An answer on the two routing rows that cannot fire (`RECOMMENDATION-MATRIX.md` §6.3) | Legal exposure and LGBTQ+-specific risk never route to their workshops |
| 3 | **ASAP** | A decision on the transition gate (§7) — keep the extra question, or move the judgement to Circle | The transition fires only for parents who answer the gate |
| 4 | **ASAP** | Circle URLs for 25 workshops and 3 discussion groups | Reports name workshops but cannot link them. One list serves this product and Sustaining Recovery both. |
| 5 | **ASAP** | Final wording for the two Universal Guiding Principles and the transition section | Placeholder copy ships verbatim, clearly marked |
| 6 | **ASAP** | Native-speaker sign-off on `SPANISH-REVIEW.md` | Spanish reports carry unreviewed wording |
| 7 | **Pavlo / ASAP** | A DNS record for `monitoring.asapcommunity.org` | The site stays on `actionplan.asap-community.org` |
| 8 | **Pavlo** | Capture the eight baseline plans against production | The parity claim covers severity but not the full routing fingerprint |

Item 8 is the only one on us, and it is **time-sensitive**: the baseline must be
captured from the live system *before* the old path is switched off. Once it is
gone there is nothing left to compare against.

```bash
API_BASE=https://<live-host> API_SECRET_KEY=... npm run baseline:capture
npm run baseline:compare   # offline; safe to run in CI on every content edit
```

---

## The switch-over

The Version 1.0 questionnaire lives at `/[lang]/v1`; the pre-existing one serves
`/[lang]` and is what parents currently reach.

**Switching is one build arg**, not a code change. In `frontend/fly.toml`:

```toml
NEXT_PUBLIC_V1_DEFAULT = '1'
```

Then redeploy the frontend with `--no-cache`, because `NEXT_PUBLIC_*` values are
inlined at build time. Setting it back to `'0'` is the way back, which is the
point: the new pipeline will not have written a plan for a real family until it
does, and a reversible switch is worth more than a tidy diff on the day.

**Before flipping it**, in this order:

1. Capture the baseline (item 8 above) — it must come from the old system.
2. `npm run baseline:compare` — offline, no API key. It fails only on a severity
   mismatch, and lists separately the resources the old system cited that the
   matrix does not route. Those are for Dave: each one is either model discretion
   the methodology never granted, or a gap in the routing table.
3. Generate one report per language against a real model and read them.
4. Get Dave's approval on the matrix.

### Then delete the old path

Once V1 has served production for a few days, the flag has done its job and two
pipelines become a liability — a stale client or a bookmarked URL still generates
plans by the old methodology, and nothing in the response says which one produced
it. Delete, in one commit:

- `src/report/` and `ReportModule` from `src/app.module.ts`
- `frontend/app/api/report/`, `frontend/app/[lang]/client.tsx`
- `frontend/app/questions.ts` — the frontend's duplicate copy of the
  questionnaire, which the V1 flow reads from the backend instead
- the `V1_IS_DEFAULT` flag and the `v1` route, folding it into `[lang]/page.tsx`

`SPEC.md` becomes historical at that point and should say so rather than being
deleted — it is the record of what the methodology was before the matrix.

---

## Launching at the new hostname

**Prerequisite:** item 7 above. `asapcommunity.org` is in a Wix account we do not
control; `sustainingrecovery.asapcommunity.org` was set up the same way, so the
path is known.

1. **Add the Fly certificate.**
   ```bash
   flyctl certs add monitoring.asapcommunity.org --app parent-report-generator-frontend
   ```
2. **Add the DNS records** Fly prints, in Wix. Wait for the certificate to issue.
3. **Point the origin at it.** In `frontend/fly.toml`, set
   `NEXT_PUBLIC_SITE_URL = 'https://monitoring.asapcommunity.org'`.
4. **Redeploy with `--no-cache`.**
   ```bash
   flyctl deploy --app parent-report-generator-api
   flyctl deploy frontend --config frontend/fly.toml \
     --app parent-report-generator-frontend --no-cache
   ```
   `--no-cache` matters: `NEXT_PUBLIC_*` values are inlined at build time and
   Docker will happily reuse a cached layer containing the old one.
5. **Redirect the old hostname** rather than dropping it, so existing links and
   whatever search visibility `actionplan.asap-community.org` has accumulated
   follow to the new host.
6. **Verify — do not assume.**
   ```bash
   # must be false, and must not say DRAFT
   curl -s https://monitoring.asapcommunity.org/api/assessment/capabilities

   # canonical must be the new host
   curl -s https://monitoring.asapcommunity.org/en | grep -o 'rel="canonical" href="[^"]*"'

   # sitemap and robots must agree with it
   curl -s https://monitoring.asapcommunity.org/sitemap.xml | head -20
   curl -s https://monitoring.asapcommunity.org/robots.txt
   ```

---

## Marking the methodology approved

Once Dave has confirmed the matrix is theirs, two status fields drive the draft
notice and the `capabilities` response:

```jsonc
// content/assessment.json
"status": "approved"          // from "draft"

// content/recommendation-matrix.json
"status": "approved"          // from "draft"
```

The landing notice reads the API at runtime, so this needs a backend deploy but
no frontend rebuild.

---

## Before real parents arrive

Worth a deliberate decision rather than a default:

- **Nothing is stored.** This product keeps no record of a submission or a plan —
  when the tab closes, the plan is gone. That is the Milestone 2 scope, and it
  brings the retention decision with it (90 days rolling for the plan, 30 for the
  answers and the generation record, scores-only kept de-identified, as
  recommended). Until then there is nothing to retain and nothing to leak.
- **A report can ship with a known wording violation.** If the model fails the
  professional-help or private-search rule on all three attempts, the plan is
  delivered anyway and the violation is logged as an error — losing a parent's
  whole plan over wording is the worse outcome. Nobody is notified. If someone
  should be, that channel does not exist yet.
- **The urgent field is passed to the model as quoted material**, delimited and
  labelled as the parent's words rather than an instruction. It is not stored,
  and no one reads it. If the intent is that a human sees what a frightened
  parent wrote, that is a Milestone 2 conversation.
- **Access and payment stay in Circle**, confirmed. Nothing in this application
  gates access.
