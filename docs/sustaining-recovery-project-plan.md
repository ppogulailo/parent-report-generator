# Sustaining Recovery Parent Action Plan — Project Plan

> **Status:** Draft scope, pending Milestone 6 approval and founder methodology input.
> **Author:** Pavlo Pohuliailo · **Date:** 2026-06-30
> A working backend scaffold already exists (see §7); this plan covers turning it into a shippable product.

## 1. Objective

Add a second Parent Action Plan to the ASAP platform, designed for parents whose child is **returning home from treatment**. It supports *sustaining recovery* — oversight, structure, relapse prevention, rebuilding trust, and responding to setbacks — rather than detecting first use, which is the focus of the existing plan.

**Target:** ready for the **one-month beta rollout**, anchoring treatment-center outreach.

## 2. What carries over vs. what's net-new

The engine is reusable; the **content and methodology are net-new and founder-driven.**

### Reuses the existing system as-is (no rework)
- Scoring engine (questionnaire → domain scores → top priorities)
- LLM gateway, streaming, retry / rate-limit handling, error response shape
- Validation pipeline, `X-API-Key` auth, response format
- The shared ASAP resource directory (4 Essential + 20 Auxiliary Workshops, 2 discussion groups) and the program-wide voice / hard rules
- The frontend questionnaire and report-rendering framework

### Net-new — requires founder methodology
- The post-treatment **questionnaire** (questions + answer wording)
- The **concern domains** for this phase
- The **system-prompt wording** (founder voice + hard rules specific to post-treatment: relapse, setbacks, securing the home environment, continuity of aftercare)
- The **section structure** of the plan
- **Relapse-warning** and **setback-response** guidance
- The recovery-stage tiers (the equivalent of MILD / MODERATE / SERIOUS for this phase)
- Full **EN + ES** content and the founder review passes

## 3. Key decisions to settle first (with Matt / Founder)

1. **Intake** — a dedicated post-treatment questionnaire (recommended; the current 24 questions are written for "is my child using?"), or reuse the existing 24? *This is the biggest scope driver — everything downstream depends on it.*
2. **Section structure** — confirm the plan's sections for this phase.
3. **Entry point** — a separate product / flow, or a mode the parent selects within the current app?
4. **Outreach specifics** — anything treatment-center-facing (co-branding, intake handoff)?

## 4. Phased approach

| Phase | Work | Notes |
|---|---|---|
| **0 — Scope & content** (founder-led) | Lock the decisions in §3; founder supplies questionnaire, domains, and methodology drafts | **Blocking input** — the critical path |
| **1 — Backend** | Wire the second report type | **Already scaffolded end-to-end**; swap in approved content |
| **2 — Founder review passes** | EN / ES × recovery tiers, same iterative wording process as the current six reports | The bulk of the content effort |
| **3 — Frontend** | Questionnaire UI, i18n content, report rendering for the new flow | |
| **4 — Testing & beta** | Full automated suite + manual review; ship into the one-month beta | |

## 5. What's needed from the Founder to start

The methodology content: the questions, how concerns are grouped into domains, the plan's section structure, and the post-treatment guidance / voice. The technical scaffold is already built, so once that content lands the build moves quickly — the founder's methodology is the real critical path, not the code.

## 6. Sequencing

This follows **Milestone 6 approval**, and slots ahead of the design refresh and the Fly.io account transfer to ASAP Community. Those two can run in parallel since they don't touch this work.

## 7. Current state — backend scaffold already built

A working second report type already runs end-to-end with **placeholder** content (clearly marked, to be replaced with founder-approved methodology):

- **Endpoints:** `POST /api/report/sustaining-recovery/generate` and `/generate/stream`
- **Location:** `src/report/sustaining-recovery/`
- **Draft intake:** 20-question post-treatment questionnaire (EN + ES)
- **Draft domains:** Relapse Risk & Safety · Home Environment & Triggers · Routine & Structure · Communication & Trust · Ongoing Support & Treatment Continuity
- **Draft sections:** Welcome Home Summary · Top 3 Immediate Priorities · Rebuilding Daily Structure · Relapse Warning Signs · What to Avoid · First Two Weeks Plan · Ongoing Support & Encouragement (+ optional Urgent Concern Acknowledged on a crisis flag)
- **Shared, not duplicated:** reuses the scoring engine, the LLM gateway, and the existing ASAP resource directory and hard rules; the existing early-intervention plan is untouched
- **Tests:** `test/sustaining-recovery.spec.ts` (14 tests, passing); all existing tests still pass
- **Response marker:** every payload carries `reportType: "sustaining-recovery"` and `draft: true`

> ⚠️ **All scaffold content is placeholder.** The questionnaire, domains, and prompt wording are engineering drafts, **not** ASAP methodology, and must be replaced with founder-approved content before this plan ships. The scaffold is structured so that content drops in cleanly.

**Not yet done:** frontend wiring (questionnaire UI + i18n + report rendering) — this is a backend-only scaffold today.
