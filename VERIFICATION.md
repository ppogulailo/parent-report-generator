# Beta Finalization — Verification Report

**Milestone:** Beta Finalization of the Monitoring & Intervention Parent Action Plan
**Branch:** `feat/beta-standardized-closing`
**Suite:** `npx playwright test` (real config — testDir `./test`) → **179 passed / 0 failed**

> Note on tiers: there are **three** computed severities (MILD / MODERATE / SERIOUS).
> The **Critical** plan is not a fourth tier — it is a SERIOUS report plus the
> URGENT-concern overlay, produced when the parent supplies the optional `crisis`
> field (which force-promotes severity to SERIOUS/GRAVE and adds an
> `URGENT CONCERN ACKNOWLEDGED` section). "Eight plans" = 3 tiers × 2 languages +
> the crisis variant per language.

## Item 1 — Standardized closing recommendation ✅ Implemented

- Added the founder-provided closing to **Moderate / Serious / Critical**, **English
  and Spanish**, as a hard rule (`system.prompt.ts`, `system.prompt.es.ts`). MILD is
  excluded. English ships the founder text verbatim; Spanish is translated in the
  plan's existing **tú** register, workshop/group titles kept in English.
- Registered the two named resources in the approved directory (`resources.ts`):
  Auxiliary Workshop *"Protecting Recovery: Preventing Relapse and Responding to
  Setbacks"* and the *"Protecting Recovery Discussion Group"* (3rd approved group).
- Reconciled with the existing ROOT CAUSE rule so the "understand why" message is
  delivered once (as the closing's 3rd paragraph), not duplicated.

## Item 3 — Verification of all eight plans

### Automatically verified (Playwright, `test/beta-verification.spec.ts`)
For every one of the 8 variants (EN/ES × Mild/Moderate/Serious/Critical):

| Check | Result |
|---|---|
| Report generation returns 200 | ✅ |
| Language selection → correct system prompt (EN vs ES) | ✅ |
| Severity classification correct (Critical = crisis-forced SERIOUS/GRAVE) | ✅ |
| Section headers in the selected language | ✅ |
| Workshop + discussion-group directory correct (3 groups / 21 workshops, new titles present) | ✅ |
| Standardized closing gated to Moderate/Serious/Critical, excluded from Mild | ✅ |
| Crisis overlay present in the Critical variant | ✅ |
| No regressions across the existing suite | ✅ (179/179) |

### NOT verifiable by the test suite — requires real generation + human review
The suite validates the **request the model receives**, because tests run against a
**mock Anthropic server** (never the real API). The following acceptance items still
require generating each plan against the live API and a human/Founder read:

- Prose quality, tone, and flow of each generated plan.
- "Approved methodology remains unchanged" at the **output** level (verified at the
  prompt level here; final confirmation is a content read).
- **Founder approval / Beta sign-off** (the milestone's acceptance criterion).

## Item 2 — English readability & flow polish ⛔ Blocked

Not started. The scope requires incorporating "the remaining Founder editorial
comments." Those notes have not been provided yet, and the work cannot be done —
or estimated — without them. **Action needed:** obtain the specific Founder
readability notes.

## Summary

| Item | Status |
|---|---|
| 1. Standardized closing (EN+ES, Mod/Ser/Crit) | ✅ Implemented & tested (prompt-level) |
| 2. English readability polish | ⛔ Blocked on Founder notes |
| 3. Beta verification | ◑ Automatable checks pass; content review + Founder approval outstanding |
