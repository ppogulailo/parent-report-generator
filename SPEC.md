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

> **Update (2026-05, decision-logic tightening for serious cases):** Three additional hard-rule blocks were added to address founder feedback that serious cases were producing under-calibrated recommendations.
> - **PROBLEM → RESOURCE ROUTING** — a hard mapping table from input patterns (peer pressure, hidden use, social media, school disengagement, mood swings, weak boundaries, co-parent misalignment, isolation, legal exposure, LGBTQ+ risk) to specific Auxiliary Workshops and Articles of Action. Routing a problem-specific concern to a discussion group when the table specifies a workshop is now disallowed — discussion groups are peer support, not a substitute for the workshop or article that addresses the problem itself.
> - **SEVERITY-GATED CONTENT** — explicit forbidden/required content per severity tier. SERIOUS may not cite the "Early Warning Signs" workshop or use awareness-stage framing ("something may be developing," "this is a good time to pay closer attention"); the parent is past that stage and must be opened at intervention level via "Intervening When Substance Use is Present". MILD may not cite "Intervening When Substance Use is Present", drug testing, behavioral contracts, treatment centers, or ASAP-endorsed therapists in the FIRST 72 HOURS PLAN or KEY PRIORITIES.
> - **SERIOUS — INTERVENTION DEPTH** — assume-resistance clause plus a banned soft-fallback list ("revisit later," "wait and see," "see how it goes," "step back from the conversation entirely," "circle back when things calm down") when used as a *next step*. DAY 3 in SERIOUS must spell out firm responses to denial / shutdown / escalation; DAYS 4 TO 7 must include at least one firm structured next step (drug test, behavioral contract, or ASAP-endorsed therapist referral with "Admin Space" in the same sentence); each KEY PRIORITIES area in SERIOUS ends with an "if [behavior] happens this week, the next step is [specific action]" trigger.
> All three blocks are mirrored in `system.prompt.es.ts`, in the SERIOUS guidance string of `classifySeverityEn`/`classifySeverityEs`, and in the reminder bullets of `buildUserPromptEn`/`buildUserPromptEs`. Resource titles remain verbatim in English in both languages.

> **Update (2026-05, founder review pass #4):** Three additional refinement blocks address feedback that BUILD THE SUPPORT GROUP was drifting into child-network territory, that generic "trusted adult" recommendations had crept in, and that the professional-help adjunct sentence needed new wording.
> - **BUILD THE SUPPORT GROUP — parent-only.** TOP 3 IMMEDIATE PRIORITIES #3 is now scoped exclusively to the parent's own peer support (joining and actively posting in the "Monitoring and Intervention discussion group"). It is no longer about the child's network. Phrases like "surround the child with trusted people," "support the child with trusted adults," "identify a trusted adult to confide in," and "reach out to a trusted adult for support" are explicitly banned in that bullet.
> - **Generic "trusted adult" recommendations banned.** A dedicated TRUSTED ADULT hard rule prohibits any generic "trusted adult" instruction directed at supporting, confiding with, or building a network around the child. Co-parent surrogate alignment (TOP 3 #2 and DAY 1) now uses "co-parent" or "another parent / guardian on the family side" rather than "trusted adult." The "Identify one trusted adult to call" instruction in DAY 2 is removed. Building the child's broader network (family, school staff, coaches, therapists, community resources) is routed exclusively through citations of the Auxiliary Workshop "Building a Support Network," and engaging schools is called out as one of its most important components every time that workshop is cited.
> - **Professional-help sentence updated.** The prior lead-in "For deeper insights, reach out to the 'Sustaining Recovery discussion group.'" is removed under all circumstances. The new canonical sequence is, verbatim and in order: "For guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program." Both sentences appear in every paragraph that references professional help. The Sustaining Recovery discussion group continues to appear only in paragraphs that recommend professional help.
> All three blocks are mirrored in `system.prompt.es.ts`, in the severity guidance strings of `classifySeverityEn`/`classifySeverityEs`, and in the reminder bullets of `buildUserPromptEn`/`buildUserPromptEs`. Resource titles remain verbatim in English in both languages.

> **Update (2026-05, founder review pass #5):** Two corrections from founder review of the latest Moderate and Serious reports.
> - **Essential vs Auxiliary Workshop categories.** The program is organized into two workshop categories: **5 Essential Workshops** (core ASAP curriculum) and **20 Auxiliary Workshops** (topic-matched). The 5 Essential are: "Creating Your Personalized Prevention Plan", "Effective Communication: Building Trust and Engagement with Your Teen", "Monitoring and Intervention: Knowing When and How to Step In", "Building a Support Network", and "Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment". `resources.ts` now exports a separate `ESSENTIAL_WORKSHOPS` constant, the user-prompt resource directory ships a fourth list (`Essential Workshops (5 total — core ASAP curriculum)`), and citation labels in the model output are `Essential Workshop "X"` for the 5 and `Auxiliary Workshop "X"` for the 20. **`Building a Support Network` is now Essential, not Auxiliary** — it has been removed from `AUXILIARY_WORKSHOPS`, and every citation throughout `system.prompt.ts`, `user.prompt.ts`, and the severity guidance strings has been re-labeled `Essential Workshop "Building a Support Network"`. The Auxiliary count drops from 21 to 20.
> - **NO PLACEHOLDERS hard rule.** A Serious report leaked the literal meta-instruction string `Add the two-sentence sequence here:` into the Days 4–7 section instead of the verbatim professional-help two-sentence sequence. A new hard rule explicitly bans placeholder / meta-reference text in output. Banned exact strings and any close variant: "Add the two-sentence sequence here", "Insert the professional help sequence", "[two-sentence sequence above]", "[sequence]", "the SR + Admin Spaces sentence", "the professional-help sequence above", "see the sequence above". Every time professional help is mentioned, both sentences ("For guidance, consider posting questions in the Sustaining Recovery discussion group." then "In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.") must be re-written in full, even if the sequence was already used earlier in the report. The sequence is a literal output string, never a referenced label.
> Both blocks are mirrored in the EN and ES reminder bullets of `buildUserPromptEn`/`buildUserPromptEs` and in the SERIOUS guidance strings of `classifySeverityEn`/`classifySeverityEs`. Resource titles remain verbatim in English in both languages.

> **Update (2026-05, founder review pass #6):** A single ASAP principle was elevated to a hard rule because it was being implied rather than written.
> - **PRIVATE SEARCH hard rule.** Whenever the plan references searching the child's room, backpack, or phone, the canonical two-sentence line must appear verbatim in that section: `"Conduct any search of your child's room, backpack, or phone privately and without your child present. Leave the room as you found it and document anything relevant."` The words "privately" and "without your child present" are non-negotiable — they must be written, not implied. "Backpack" now belongs in the search-object list alongside "room" and "phone" everywhere a search is named (LANGUAGE PRECISION anti-pattern, SOFT SEARCH block header + bullets, WHAT TO AVOID, FIRST 72 HOURS PLAN DAY 2). The prior wording `"Do not search your child's room or phone in a confrontational way"` is replaced by `"Do not search your child's room, backpack, or phone in a confrontational way"` throughout. The SOFT SEARCH section header is now `SOFT SEARCH — HOW TO FRAME ROOM / BACKPACK / PHONE CHECKS`.
> The rule is mirrored in `system.prompt.es.ts` (canonical Spanish line: `"Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente. Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante."`), in the reminder bullets of `buildUserPromptEn`/`buildUserPromptEs`, and in all three severity guidance strings of `classifySeverityEn`/`classifySeverityEs` (the rule fires whenever the Day 2 soft-search bullet is recommended — possible at every tier when secrecy or hidden use is indicated). Resource titles remain verbatim in English in both languages.

> **Update (2026-05-27, founder review pass #9 — methodology standardization):** Seven refinements landed in a single batch following the founder's review of the latest Mild / English Crisis / Spanish reports.
> - **REWARDS PAIRED WITH CONSEQUENCES — hard rule (EN + ES).** ASAP philosophy is rewards-and-consequences, not consequences alone. The plan must never write "consequences" alone — pair with "rewards" in the same sentence or bullet, using canonical forms "rules, rewards, and consequences" or "clear expectations, rewards, and consequences." Mirrored in `system.prompt.ts`, `system.prompt.es.ts`, and the reminder bullets of `buildUserPromptEn`/`buildUserPromptEs`.
> - **UNKNOWN SUBSTANCE — never "pills" (EN + ES).** Crisis-path and any soft-search / found-evidence copy uses "unknown substance" framing instead of "pills" — fentanyl, pressed pills, powders, counterfeit prescriptions, vape cartridges, edibles all carry overdose risk and naming "pills" alone misdescribes the threat. Hard rule mirrored across both system prompts, the URGENT section, the WHAT TO AVOID section, the DAY 2 soft-search bullet, and both user-prompt reminder bundles. The literal "pressed-pill ingestion" inside the URGENT trigger map is allowed as a medical-resource category descriptor (the only exception).
> - **EMOTIONAL REGULATION FIRST — every tier (EN + ES).** The parent's emotional regulation opens TOP 3 #1 and DAY 1 in every tier (MILD, MODERATE, SERIOUS, URGENT). The step never gets skipped or downgraded based on severity; only the tactical layer shifts. Severity guidance strings for all three tiers now carry this rule explicitly, and the URGENT section names it too.
> - **REVIEW RESOURCES BEFORE THE CONVERSATION — every tier (EN + ES).** Before DAY 3's conversation, the parent reviews the relevant Auxiliary Workshop (cited by exact title, matched to the strongest concern) AND the relevant substance facts. The DAY 2 anchor was renamed to `DAY 2 — BUILD YOUR PERSONAL SUPPORT GROUP + GATHER INFORMATION + REVIEW RESOURCES` (EN) / `DÍA 2 — CONSTRUIR TU GRUPO PERSONAL DE APOYO + REUNIR INFORMACIÓN + REVISAR RECURSOS` (ES) and the canonical phrasing pattern is "Having the information in your head means you respond from facts, not fear."
> - **BUILD YOUR PERSONAL SUPPORT GROUP — canonical wording (EN + ES).** TOP 3 #3 was renamed from `BUILD THE SUPPORT GROUP` to `BUILD YOUR PERSONAL SUPPORT GROUP` and standardized to the verbatim opening line: "BUILD YOUR PERSONAL SUPPORT GROUP — Join and actively post in the 'Monitoring and Intervention discussion group.' Connecting with other parents facing similar challenges can provide insight and support as you work through this. This group is an invaluable source of shared experience." The parent's personal support group is explicitly framed as GROWING WITH SEVERITY — may include the other parent, primary/extended family, trusted friends, school staff (teachers, counselors, coaches, deans), doctors, community resources, and therapists. Spanish anchor: `CONSTRUIR TU GRUPO PERSONAL DE APOYO`.
> - **Spanish MILD openings — "Entiendo que" banned.** A new hard rule (`APERTURAS DIRECTAS — NO "ENTIENDO QUE"`) bans "Entiendo que estás pasando por…", "Entiendo lo difícil que es…", "Sé que estás atravesando…" and any close variant in Spanish output (RESUMEN INICIAL and elsewhere). Replace with direct framing: "Estás pasando por…", "Lo que describes es…", "Lo que estás viendo es…". Rule lives in `system.prompt.es.ts` (LEVE block + RESUMEN INICIAL guidance) and in the ES reminder bullets of `buildUserPromptEs`.
> - **BANNED PREVENTION WORKSHOP TITLES — both names banned (EN + ES).** `ESSENTIAL_WORKSHOPS` dropped from 5 → 4: "Creating Your Personalized Prevention Plan" was removed because it is a hallucinated title (never an actual workshop). The real workshop "Creating Your Personal Prevention Program" is also banned from any Parent Action Plan output per founder direction (separate methodological reasons). A `BANNED PREVENTION WORKSHOP TITLES` hard rule blocks both names everywhere in the plan; both may appear in the prompt only inside the ban context. The Q11 routing (weak co-parent / caregiver alignment) was re-routed from "Creating Your Personalized Prevention Plan" to the Essential Workshop "Building a Support Network." The user-prompt directory header reads `Essential Workshops (4 total — citable in plan output)`.
> All seven changes are mirrored across `system.prompt.ts`, `system.prompt.es.ts`, the reminder bullets of `buildUserPromptEn`/`buildUserPromptEs`, the severity guidance strings in `classifySeverityEn`/`classifySeverityEs`, and `resources.ts` (which now ships a BANNED PREVENTION WORKSHOP TITLES note in the directory output). New tests in `test/api.spec.ts` and `test/language.spec.ts` lock in each rule (7 EN assertions + 8 ES assertions, all green). Total suite: 134 tests passing.

> **Update (Milestone 6, 2026-05-19):** Four input/severity/section changes were applied in a single batch.
> - **Per-question behavior-anchored answer labels.** The 1–4 scale used to share one set of endpoint labels across every question (`1 — Strong`, `4 — Concerning`). It now carries `ANSWER_LABELS` (`questions.ts`) and `ANSWER_LABELS_ES` (`questions.es.ts`) — 24 × 4 strings where score 1 always represents the strength end and score 4 always represents the concern end, regardless of whether the question stem is "more = worse" (frequency, intensity) or "more = better" (confidence, alignment, readiness). Inverted-stem questions (Q6, Q11, Q13, Q14, Q15, Q18, Q19, Q20, Q21, Q22, Q24) are handled entirely by the labels — the parent never has to translate. `buildUserPromptEn`/`buildUserPromptEs` now include each scored 1 / scored 4 question's chosen label in the Strong concerns / Strengths blocks (`Parent's answer: <label>` / `Respuesta del padre: <label>`), giving the model the specific behavior the parent reported instead of just the question stem. The frontend `ANSWER_LABELS` constant in `frontend/app/i18n.ts` mirrors the backend and renders each option as `<num>` + `<label>` in a vertical stack (replaces the old shared `SCALE_LABELS`).
> - **Severity-gate recalibration.** Two changes to `computeSeverityTier` in `src/report/prompts/user.prompt.ts`. (a) Q23 ("worry about long-term consequences") and Q24 ("readiness to take decisive action") are excluded from the SERIOUS gate: the previous `SAFETY_QUESTION_INDICES = [0,1,9,22,23]` is replaced by `CHILD_SAFETY_INDICES = [0,1,9]` (Q1, Q2, Q10 only). The SERIOUS gate now uses `childSafetyAvg >= 3` (instead of `safetyDomainAvg >= 3`) and `childSafetyFours >= 1` (instead of `safetyFours >= 1`); the MILD floor uses `childSafetyAvg < 2.0`. Q23 and Q24 remain in `DOMAIN_MAP['Immediate Safety & Urgency']` for scoring and the displayed domain score — per founder direction (2026-05-19): "keep them in the scoring and reporting framework, but remove them from the logic that independently promotes a report to SERIOUS." (b) A new hard escalator: any non-empty trimmed `crisis` field force-promotes the report to SERIOUS regardless of the 24 scores.
> - **Optional crisis field + URGENT CONCERN ACKNOWLEDGED section.** `GenerateReportDto` gains an optional `crisis?: string` (max 500 chars) — see §7.2. When supplied non-empty, the user-prompt template appends an `URGENT CONCERN — parent flagged this …` context block, the severity hard escalator fires (auto-SERIOUS), and the model is instructed to emit an extra section header **before** HEADLINE SUMMARY: `URGENT CONCERN ACKNOWLEDGED` (EN) / `PREOCUPACIÓN URGENTE RECONOCIDA` (ES). The section is 2–3 calm, direction-giving sentences that name the specific concern (in the model's own words, never verbatim quoting) and pin the matching emergency resource from a trigger-keyword map: 988 Suicide & Crisis Lifeline (suicidality / self-harm), 911 + National Domestic Violence Hotline 1-800-799-7233 (active violence in the home), Poison Control 1-800-222-1222 + naloxone / Narcan (suspected fentanyl / overdose / opioid ingestion), National Runaway Safeline 1-800-786-2929 (running away / missing nights), 911 default for anything not on the map. The professional-help two-sentence sequence (`Sustaining Recovery discussion group` + Admin Spaces) fires inside the URGENT section whenever a therapist / treatment provider is named in the same paragraph. The section closes with an explicit "the rest of the plan continues from here" line so the parent does not read it as standalone. `SECTION_HEADERS_EN` and `SECTION_HEADERS_ES` grow from 7 to 8 entries (URGENT first); `ReportSections` gains `urgentConcern: string` (empty string when not fired); `claude.service` parses the new header. The frontend renders the URGENT section with a red-tinted treatment (`.section-urgent`) at the top of results when present.
> - **Frontend crisis-field UI.** A new optional `<textarea>` appears after Q24 in `client.tsx`, capped at 500 characters, paired with a static safety notice: "If your child is in immediate danger, call 911. For a suicide or mental-health crisis, call or text 988. For suspected overdose or poisoning, Poison Control: 1-800-222-1222." (ES mirror in `STRINGS.es`). The crisis value is forwarded to `/api/report/stream` only when non-empty; the proxy in `frontend/app/api/report/stream/route.ts` already forwards the body verbatim and required no change.
> - **Founder review pass #10 (2026-06-26) — wording & content refinements (EN + ES).** Relayed by Matthew after the founder reviewed all four EN and three ES reports. (1) *DAY 3 review lead-in* now reads "Before DAY 3's conversation **with your child**" everywhere it appears (EN system + EN user reminder). (2) *Co-parent alignment* (TOP 3 #2) must name who is aligning — "Make sure you and your co-parent are clear on the household rules, rewards, and consequences" — never a subjectless "get clear together." (3) *Parent emotional-regulation label* is pinned to the exact gender-neutral "PARENT EMOTIONAL REGULATION" (EN) and the ES heading changed from `REGULACIÓN EMOCIONAL DEL PADRE` → `REGULACIÓN EMOCIONAL DE LOS PADRES` (the `DEL PADRE` form browser-translated to "…FOR THE FATHER," the founder's complaint); gendered variants are banned. (4) New `NO AMBIGUOUS / GENDERED REFERENTS` hard rule bans bare "he/she" and gendered nouns for parent/child (fixes the ambiguous "He arrives clear and calm"), and a `NO VAGUE / UNCLEAR CONSTRUCTIONS` rule bans the unclear "Name this straight" / "puts you at a disadvantage" framing. (5) *Critical (crisis/URGENT) opening concern* drops vape/vaping and uses the founder framing "You've found an unknown substance — and/or your child has admitted to using heroin, fentanyl, or another drug that can cause serious harm" (EN + ES); vape still allowed later in the body per the general UNKNOWN SUBSTANCE rule. (6) New `CRITICAL CLOSING` hard rule (fires only when an URGENT CONCERN block is present): the closing must state plainly that what happens next may significantly affect the child's safety, health, and potentially their life, and direct the parent — if use continues — to ASAP's preferred residential treatment centers and IOP programs (Admin Spaces → Treatment Providers), which fires the professional-help sequence (EN + ES). (7) ES naloxone guidance strengthened: keep naloxone (Narcan) in the home, the vehicle, and with caregivers when opioid use is suspected. (8) ES MILD (LEVE) closing now reminds the parent that children and circumstances keep changing — keep assessing over time — and encourages ongoing ASAP Community + Monitoring and Intervention discussion group participation. (9) ES SERIOUS (GRAVE) guidance adds: stronger drug-testing emphasis (cite "Drug Testing"), a directive to learn the facts of the child's drug of choice and teach them calmly, and — if the child takes prescribed medication alongside illicit use — inform the prescribing physician. **Open conflict flagged for founder confirmation:** item (9) also references "Know the Facts" / **Article of Action #2** by name in ES GRAVE, which contradicts the standing hard rule that Articles of Action are never cited by title; implemented as a narrow ES-GRAVE carve-out pending confirmation. Changes live in `system.prompt.ts`, `system.prompt.es.ts`, and the severity-guidance / reminder strings in `user.prompt.ts`. Deterministic placement is covered by `scripts/check-founder-edits.ts`.
> All four changes ship together so the DTO shape, scoring, prompt, and UI move in lockstep. Tests in `test/api.spec.ts` and `test/language.spec.ts` cover: crisis-field DTO acceptance/rejection, the SERIOUS auto-escalator, the Q23/Q24 demotion (including a regression that previously promoted via `safetyFours`), the per-question answer labels in concerns/strengths blocks, the conditional header list in the user-prompt closing instruction (EN+ES), and the URGENT section parsing into `report.urgentConcern`. The mock OpenAI server in `test/global-setup.ts` now branches its response body on the presence of the `URGENT CONCERN — parent flagged this` context-block header, so it returns an 8-section payload when the crisis fires and the 7-section baseline otherwise.

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
  "responses": [3, 2, 4, 1, 3, 2, 4, 3, 2, 3, 2, 3, 1, 2, 3, 2, 4, 3, 2, 1, 2, 3, 4, 3],
  "language": "en",
  "crisis": "Found pills in the bedroom. Worried about fentanyl."
}
```

- `responses` — required. Array of exactly 24 integers, each between 1 and 4. Index 0 = Q1, index 23 = Q24.
- `language` — optional. `"en"` (default) or `"es"`.
- `crisis` — optional. Free-text up to 500 characters. When non-empty (after trim) the report is force-promoted to SERIOUS severity and prefixed with an `URGENT CONCERN ACKNOWLEDGED` section (see Milestone 6 update in §6.1).

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
