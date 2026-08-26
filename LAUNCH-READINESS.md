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
| Dave's decisions of 2026-08-25 implemented: matrix approved, Q4 into Immediate Safety & Urgency, legal/LGBTQ+ rows removed from routing, Creating a Healthy Home Environment made a rule, Early Warning Signs confirmed | `RECOMMENDATION-MATRIX.md` — decisions recorded inline; `content/` marked `approved` |
| Transition to Sustaining Recovery **removed by that decision** — the FRAAP stays at 24 questions and the transition lives in the Circle program journey; the gate mechanism remains for future content | git history has the gate and section; `RECOMMENDATION-MATRIX.md` §7 |
| English/Spanish held in one record per string, both required at boot | `src/content/schemas/rule.schema.ts` → `localizedStringSchema` |
| Spanish strings listed for sign-off | `SPANISH-REVIEW.md` — 209 strings, generated from content |
| Prompts moved out of code into content | `content/report-templates/` |
| Banned vocabulary, empathy filler and softened referrals checked, not just prompted | `content/voice.json`, `src/generation/voice-rules.ts` |
| Answer labels cannot be quoted back at the parent | `checkAnswerLabels` |
| Baseline comparison runs offline, so it can gate CI | `scripts/compare-baseline.ts` |
| Switch-over is a build arg, and reversible | `frontend/app/site.ts` → `V1_IS_DEFAULT` |
| Baseline captured from the current system; no severity moved on any of 8 plans | `baseline/`, `npm run baseline:compare` |
| Verified against the real model — all 4 severities × both languages, every rule satisfied | `verification/`, `npm run verify:real-model` |
| Five defects found by those runs and fixed | `RECOMMENDATION-MATRIX.md` §6.8–§6.10 |
| Site origin centralised so the hostname change is config, not code | `frontend/app/site.ts` |

| The endpoint, the guard, the validator and the retry loop tested over real HTTP | `test/v1/api.v1.spec.ts` — 31 tests against a mock model |
| A parent can complete the questionnaire and read a plan, in a browser | `test/v1/ui.v1ui.spec.ts` — 20 tests, self-contained stack |

**Test state:** 127 tests — 76 unit, 31 API, 20 browser, plus 8 real-model plans. `npm run content:validate`
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
of those 51 tests fails.

Failure modes are reachable on demand rather than waited for: the mock can invent
a workshop, omit a priority area, write a section the platform owns, return prose
instead of JSON, or violate a wording rule once and then comply. Those are the
paths a real model takes intermittently and unreproducibly.

---

## Blocked, and on whom

Resolved 2026-08-25, by Dave via Matt: the matrix is approved, the two routing
rows are removed from routing (workshops stay in ASAP Community), and the
transition question is dropped — the transition lives in the Circle program
journey. All three are implemented.

Resolved 2026-08-26, also via Matt: the final wording for both Universal
Guiding Principles is installed verbatim; the Creating a Healthy Home
Environment trigger (Q20/Q21) is confirmed; and the formal product name is
*Family* Risk Assessment & Action Plan (FRAAP), now applied to this product's
pages and metadata.

| # | Blocked on | What is needed | Effect until it lands |
|---|---|---|---|
| 1 | **ASAP** | Circle URLs for 25 workshops and 3 discussion groups — Emmanuel is assembling them | Reports name workshops but cannot link them. One list serves this product and Sustaining Recovery both. |
| 2 | **ASAP** | Native-speaker sign-off on `SPANISH-REVIEW.md` — now including our translations of the two Guiding Principles | Spanish reports carry unreviewed wording |
| 3 | **Pavlo / ASAP** | A DNS record for `monitoring.asapcommunity.org` | The site stays on `actionplan.asap-community.org` |
Nothing on this list is on us any more. The baseline is captured and committed
(`baseline/`), and the pipeline has been verified against the real model.

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

1. ~~Capture the baseline~~ — done, committed under `baseline/`.
2. ~~Compare it~~ — done. No severity moved; §6.8 catalogues the resource
   differences for Dave.
3. ~~Generate against a real model and read it~~ — done for all four severities
   in both languages; §6.8–§6.10 record what it found. Re-run with
   `npm run verify:real-model` after any prompt or content change — and again
   now: the 2026-08-25 decisions changed the routing, so the committed
   verification plans predate them.
4. ~~Get Dave's approval on the matrix~~ — received 2026-08-25, including the
   Effective Communication rule and its threshold. Implemented, with the
   decisions recorded inline in `RECOMMENDATION-MATRIX.md`.

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

**Prerequisite:** item 3 above. `asapcommunity.org` is in a Wix account we do not
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

Done, 2026-08-25. Both `content/assessment.json` and
`content/recommendation-matrix.json` carry `"status": "approved"`, so the
draft notice disappears and `capabilities` reports `draft: false` on the next
backend deploy — the landing notice reads the API at runtime, so no frontend
rebuild is needed.

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
