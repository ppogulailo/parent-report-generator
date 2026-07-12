# Design Data Pack — ASAP Parent Action Plan

Companion to `UI_REDESIGN_PROMPT.md`. All copy below is the **real, production copy**
pulled from the app (`frontend/app/i18n.ts`). Answer-label direction: **1 = strong /
healthy end, 4 = concerning end** — the label text carries the direction so the parent
never has to translate a bare number.

---

## Answers to the designer's questions

1. **Deliverable:** A standalone, high-fidelity interactive React/HTML prototype with
   **mock SSE streaming** (real state + transitions) is exactly right. Our engineers will
   port it into the live Next.js client component. You do not need repo access.
2. **Real copy:** Provided in full below (both languages) + a representative example plan.
3. **Languages this pass:** **Build English first**, but design the layout to survive
   Spanish — ES runs ~15–25% longer and some answer labels are long. Full ES copy is
   included so you can pressure-test wrapping. (Do not ship an EN-only layout that breaks
   in ES.)
4. **Urgent concern:** Exact safety-notice text + hotlines are below. Direction: visually
   **distinct and serious, but calm — never alarmist** (no blaring red banners). It's the
   one place a restrained alert color is appropriate.
5. **Domains + section markers:** Real ones below (do not invent).
6. **Design variations:** **Two** distinct hero/overall-vibe directions to compare, then
   converge to one for the full flow. (One warmer/human, one calmer/clinical-trust, your
   interpretation.)
7. **Dark mode:** **Light-first** is the priority. A dark variant is a welcome bonus
   (parents do use this late at night, scared) but not required for this pass.

---

## Scoring / severity model (context for the results screen)

- 24 answers → **5 concern domains**, each scored **1.00–4.00** (shown as bars).
- **Top 3** domains are surfaced.
- Backend computes a severity tier — **Mild / Moderate / Serious** — that shapes the plan.
  There is **no separate "Critical" tier**: the *Critical* plan is a Serious plan **plus an
  URGENT overlay**, produced when the parent fills the optional crisis field. Design does
  not need to display the tier; it's reflected in the plan's content and the urgent section.

## The 5 concern domains

| English (API key + EN label) | Spanish label |
|---|---|
| Immediate Safety & Urgency | Seguridad inmediata y urgencia |
| Household Structure | Estructura del hogar |
| Boundary Consistency | Consistencia de límites |
| Communication & Conflict | Comunicación y conflicto |
| Support & Professional Engagement | Apoyo y acompañamiento profesional |

## Report sections — order, display label, and stream marker

Sections stream in this order. The **marker** is the ALL-CAPS string the model emits; the
prototype's mock stream should emit these so the parser can segment. `Urgent Concern`
appears **first and only** when a crisis was entered.

| # | key | EN display label | EN stream marker |
|---|---|---|---|
| 0 | urgentConcern | Urgent Concern Acknowledged | `URGENT CONCERN ACKNOWLEDGED` *(conditional)* |
| 1 | headlineSummary | Headline Summary | `HEADLINE SUMMARY` |
| 2 | topImmediatePriorities | Top 3 Immediate Priorities | `TOP 3 IMMEDIATE PRIORITIES` |
| 3 | keyPriorities | Key Priorities | `KEY PRIORITIES` |
| 4 | whatToAvoid | What to Avoid | `WHAT TO AVOID` |
| 5 | first72Hours | First 72 Hours Plan | `FIRST 72 HOURS PLAN` |
| 6 | days4to7 | Days 4–7 Continuation | `DAYS 4 TO 7 CONTINUATION` |
| 7 | encouragement | Encouragement & Direction | `ENCOURAGEMENT AND DIRECTION` |

ES display labels: Preocupación urgente reconocida · Resumen inicial · 3 Prioridades
inmediatas · Prioridades clave · Qué evitar · Plan de las primeras 72 horas · Días 4 a 7 —
Continuación · Aliento y dirección.

---

## Hero & framing copy (EN)

- **Eyebrow:** Parent Action Plan
- **Title:** A calm, clear plan when you need it most
- **Subhead:** This tool helps parents quickly create a clear, step-by-step action plan to
  support their child dealing with substance use — in just a few minutes.
- **Benefits:** Understand what steps to take immediately · Get a structured plan tailored
  to your situation · Move forward with clarity and confidence
- **Meta:** 24 short questions · About 3 minutes · Confidential
- **Reassurance:** You are in the right place. Start when you are ready.
- **Start button:** Start the questionnaire

**Questionnaire heading:** A few questions about your situation
**Questionnaire sub:** Answer each on a 1–4 scale. 1 means things feel strong or healthy. 4
means things feel concerning. There are no right or wrong answers — your honest responses
help shape the plan.
**Progress:** "Answered {n} of 24" · **Jump link:** Jump to next unanswered

## Status / streaming microcopy (EN)

- Generate button: **Generate Action Plan** (loading: "Scoring your answers…" →
  "Writing your plan…")
- Scoring card: **Scoring your answers…** / Mapping 24 responses to 5 concern domains.
- Writing card: **Writing your plan…** / Your plan is being written in real time below.
  This usually takes 20–40 seconds.
- Done card: **Your plan is ready.** / Take your time reading through it — you can come back
  later to any section.
- Results headings: **Domain Scores** · **Top Priorities** · **Action Plan**

## Crisis field + safety notice (EN) — verbatim, do not paraphrase

- **Heading:** Anything urgent we should know? (optional)
- **Intro:** If something acute is happening — suspected fentanyl exposure, overdose,
  threats of self-harm, or violence at home — write a short note here. The plan will open
  with that concern and pin the right emergency resource. Skip this if it does not apply.
- **Field label:** Urgent concern · **Placeholder:** e.g. Found a pill press in the bedroom
  last week. Worried about fentanyl. · **Char limit:** 1500 (show remaining)
- **Safety notice (must appear near the field):** *If your child is in immediate danger,
  call 911. For a suicide or mental-health crisis, call or text 988. For suspected overdose
  or poisoning, Poison Control: 1-800-222-1222.*

ES safety notice: *Si tu hijo está en peligro inmediato, llama al 911. Para crisis suicida o
de salud mental, llama o envía un mensaje al 988 (también atiende en español). Para sospecha
de sobredosis o envenenamiento, Poison Control: 1-800-222-1222.*

---

## The 24 questions with 4 labeled points — ENGLISH

Format: **Q. question** — `1` label · `2` label · `3` label · `4` label

1. How certain are you that your child has used drugs, alcohol, or other substances? — `1` Confident they haven't · `2` Not sure, but I don't think so · `3` Strongly suspect · `4` Confirmed or seen direct evidence
2. How frequently do you suspect substance use may be occurring? — `1` Never · `2` Once or twice, isolated · `3` A few times a month · `4` Weekly or more
3. Have you observed secrecy, lying, or avoidance when discussing concerns? — `1` No — open and honest · `2` Occasionally evasive · `3` Often secretive or avoidant · `4` Constantly — won't engage at all
4. How often does your child spend time in environments where substances may be present? — `1` Rarely or never · `2` Occasionally · `3` Often — most weekends · `4` Most of their free time
5. How intense are conflicts between you and your child regarding behavior or rules? — `1` Calm — disagreements resolve easily · `2` Occasional tension · `3` Frequent arguments · `4` Yelling, slamming doors, near-daily
6. How confident do you feel confronting your child about substance concerns? — `1` Confident — I know what to say · `2` Somewhat confident · `3` Unsure how to approach it · `4` Avoid it entirely — dread the conversation
7. How consistent are consequences when rules are broken? — `1` Always consistent · `2` Mostly consistent · `3` Inconsistent · `4` Rules rarely or never enforced
8. How often do you feel unsure whether you are overreacting or underreacting? — `1` Almost never · `2` Occasionally · `3` Often — second-guess most of the time · `4` Constantly — paralyzed by doubt
9. Have you noticed significant mood swings, withdrawal, or aggressive behavior? — `1` No noticeable change · `2` Mild changes · `3` Clear and frequent changes · `4` Dramatic or near-daily changes
10. How concerned are you about your child's safety (driving, risky environments, etc.)? — `1` Not concerned · `2` Mildly concerned · `3` Serious concern · `4` Active fear — lose sleep over it
11. How aligned are caregivers or co-parents in responding to the situation? — `1` Fully aligned — same page on rules and tone · `2` Mostly aligned · `3` Disagree often · `4` Pulling in opposite directions, or no co-parent contact
12. How often does your child spend time with peers you consider a negative influence? — `1` Rarely or never · `2` Some peers I worry about · `3` Most of their friends are concerning · `4` Almost exclusively with peers I distrust
13. How comfortable is your child discussing stress, anxiety, or emotional pain? — `1` Very comfortable — talks openly · `2` Sometimes shares · `3` Rarely shares · `4` Shuts down completely — won't engage
14. How frequently do you monitor your child's whereabouts and activities? — `1` Consistently — always know · `2` Most of the time · `3` Often unsure · `4` Rarely know where they are
15. How supported do you feel by school staff or community professionals? — `1` Very supported — actively in touch with school / coaches · `2` Some support · `3` Limited support · `4` Feel alone — no school or community contact
16. Have you sought guidance from a therapist, counselor, or treatment provider? — `1` Yes, currently working with one · `2` Reached out, exploring options · `3` Considered but haven't yet · `4` No — wouldn't know where to start
17. How often do you feel exhausted, fearful, or overwhelmed by the situation? — `1` Rarely or never · `2` Occasionally · `3` Often — most weeks · `4` Near-daily — running on empty
18. How clear is your plan for next steps if substance use continues? — `1` Very clear — written plan aligned with co-parent · `2` Some idea, not detailed · `3` Unsure what to do next · `4` No plan at all
19. How often does your child accept responsibility for their behavior? — `1` Owns mistakes consistently · `2` Sometimes · `3` Rarely · `4` Never — blames others or denies
20. How much structure currently exists in your child's daily routine? — `1` Strong routine — sleep, school, meals, activities · `2` Some structure, gaps in places · `3` Inconsistent · `4` Little or no structure
21. How confident are you that your home environment discourages substance use? — `1` Very confident — clear rules, no access, aligned messaging · `2` Mostly confident · `3` Unsure · `4` Concerned — access, exposure, or mixed messages at home
22. How prepared do you feel to set firm but supportive boundaries? — `1` Fully prepared · `2` Somewhat prepared · `3` Uncertain how to balance firm and supportive · `4` Don't know where to begin
23. How frequently do you worry about long-term consequences if patterns continue? — `1` Rarely · `2` Occasionally · `3` Often · `4` Constantly — affects sleep, work, or daily mood
24. How ready are you to take decisive action to protect your child's well-being? — `1` Ready now — committed to act · `2` Mostly ready · `3` Hesitant · `4` Stuck — don't know what to do

## The 24 questions with 4 labeled points — SPANISH

1. ¿Qué tan seguro estás de que tu hijo ha consumido drogas, alcohol u otras sustancias? — `1` Seguro que no · `2` No estoy seguro, pero creo que no · `3` Lo sospecho fuertemente · `4` Confirmado o he visto evidencia directa
2. ¿Con qué frecuencia sospechas que puede estar ocurriendo consumo de sustancias? — `1` Nunca · `2` Una o dos veces, aislado · `3` Varias veces al mes · `4` Semanalmente o más
3. ¿Has notado secretismo, mentiras o evasión cuando intentas hablar de lo que te preocupa? — `1` No — abierto y honesto · `2` A veces evasivo · `3` Frecuentemente secretista o evasivo · `4` Constantemente — no se abre en absoluto
4. ¿Con qué frecuencia tu hijo pasa tiempo en entornos donde puede haber sustancias? — `1` Rara vez o nunca · `2` Ocasionalmente · `3` A menudo — la mayoría de los fines de semana · `4` La mayor parte de su tiempo libre
5. ¿Qué tan intensos son los conflictos entre tú y tu hijo respecto al comportamiento o las reglas? — `1` Calmados — los desacuerdos se resuelven fácilmente · `2` Tensión ocasional · `3` Discusiones frecuentes · `4` Gritos, portazos, casi a diario
6. ¿Qué tan preparado te sientes para confrontar a tu hijo sobre tus preocupaciones de consumo? — `1` Preparado — sé qué decir · `2` Algo preparado · `3` No sé cómo abordarlo · `4` Lo evito — me angustia la conversación
7. ¿Qué tan consistentes son las consecuencias cuando se rompen las reglas? — `1` Siempre consistentes · `2` Casi siempre consistentes · `3` Inconsistentes · `4` Rara vez o nunca se aplican
8. ¿Con qué frecuencia dudas si estás reaccionando de más o de menos? — `1` Casi nunca · `2` Ocasionalmente · `3` A menudo — dudo la mayor parte del tiempo · `4` Constantemente — paralizado por la duda
9. ¿Has notado cambios importantes de ánimo, aislamiento o conductas agresivas? — `1` Sin cambios notables · `2` Cambios leves · `3` Cambios claros y frecuentes · `4` Cambios dramáticos o casi a diario
10. ¿Qué tan preocupado estás por la seguridad de tu hijo (al conducir, entornos de riesgo, etc.)? — `1` No me preocupa · `2` Levemente preocupado · `3` Preocupación seria · `4` Miedo activo — pierdo el sueño
11. ¿Qué tan alineados están los cuidadores o co-padres al responder a esta situación? — `1` Totalmente alineados — mismo criterio en reglas y tono · `2` Mayormente alineados · `3` En desacuerdo a menudo · `4` Cada uno por su lado, o sin contacto con el co-padre
12. ¿Con qué frecuencia tu hijo pasa tiempo con compañeros que consideras una mala influencia? — `1` Rara vez o nunca · `2` Algunos compañeros me preocupan · `3` La mayoría de sus amigos son preocupantes · `4` Casi exclusivamente con compañeros en los que no confío
13. ¿Qué tan cómodo se siente tu hijo al hablar de estrés, ansiedad o dolor emocional? — `1` Muy cómodo — habla abiertamente · `2` A veces comparte · `3` Rara vez comparte · `4` Se cierra por completo — no se abre
14. ¿Con qué frecuencia monitoreas dónde está y qué hace tu hijo? — `1` Consistentemente — siempre sé · `2` La mayor parte del tiempo · `3` A menudo no estoy seguro · `4` Rara vez sé dónde está
15. ¿Qué tan apoyado te sientes por el personal escolar o profesionales de la comunidad? — `1` Muy apoyado — en contacto activo con la escuela / entrenadores · `2` Algo de apoyo · `3` Apoyo limitado · `4` Me siento solo — sin contacto con la escuela ni la comunidad
16. ¿Has buscado orientación con un terapeuta, consejero o proveedor de tratamiento? — `1` Sí, trabajando con uno actualmente · `2` He buscado, explorando opciones · `3` Lo he considerado pero aún no · `4` No — no sabría por dónde empezar
17. ¿Con qué frecuencia te sientes agotado, con miedo o abrumado por la situación? — `1` Rara vez o nunca · `2` Ocasionalmente · `3` A menudo — la mayoría de las semanas · `4` Casi a diario — sin combustible
18. ¿Qué tan claro tienes el plan de próximos pasos si el consumo continúa? — `1` Muy claro — plan escrito alineado con el co-padre · `2` Una idea, no detallada · `3` No sé qué hacer · `4` Sin plan alguno
19. ¿Con qué frecuencia tu hijo asume responsabilidad por su comportamiento? — `1` Asume sus errores consistentemente · `2` A veces · `3` Rara vez · `4` Nunca — culpa a otros o niega
20. ¿Cuánta estructura existe actualmente en la rutina diaria de tu hijo? — `1` Rutina sólida — sueño, escuela, comidas, actividades · `2` Algo de estructura, con vacíos · `3` Inconsistente · `4` Poca o ninguna estructura
21. ¿Qué tan seguro estás de que el ambiente en casa desalienta el consumo de sustancias? — `1` Muy seguro — reglas claras, sin acceso, mensaje alineado · `2` Mayormente seguro · `3` No estoy seguro · `4` Preocupado — acceso, exposición o mensajes mixtos en casa
22. ¿Qué tan preparado te sientes para establecer límites firmes pero con apoyo? — `1` Totalmente preparado · `2` Algo preparado · `3` Inseguro de cómo equilibrar firmeza y apoyo · `4` No sé por dónde empezar
23. ¿Con qué frecuencia te preocupan las consecuencias a largo plazo si los patrones continúan? — `1` Rara vez · `2` Ocasionalmente · `3` A menudo · `4` Constantemente — me afecta el sueño, el trabajo o el ánimo
24. ¿Qué tan listo estás para actuar con decisión y proteger el bienestar de tu hijo? — `1` Listo ahora — comprometido a actuar · `2` Mayormente listo · `3` Vacilante · `4` Atascado — no sé qué hacer

---

## Representative example plan (ILLUSTRATIVE — for layout only)

> This is **sample content authored for the prototype**, matching the real plan's structure,
> tone, and length. It is NOT a real generated plan and must NOT be shipped as canned text —
> the live app generates every plan fresh. Use it to stress-test section layout, bullet
> lists, and streaming. Example shows a **Moderate** plan plus the optional urgent block.

**URGENT CONCERN ACKNOWLEDGED** *(only present when the parent entered a crisis note)*
You flagged that you found an unknown substance and are worried about fentanyl — we're
putting that first. Keep naloxone (Narcan) accessible; most pharmacies dispense it without a
prescription. If you suspect an overdose, call 911 immediately, and keep Poison Control
(1-800-222-1222) saved in your phone. Make the call the moment you need it — your steady
voice is doing the work. The rest of this plan picks up from there.

**HEADLINE SUMMARY**
You're carrying real worry right now, and the fact that you're here — trusting your gut that
something has shifted — matters. Your answers point to growing secrecy and rising tension at
home, alongside a genuine willingness to act. This plan builds on the ASAP work you've
already started and gives you the next concrete steps.

**TOP 3 IMMEDIATE PRIORITIES**
- **Parent Emotional Regulation** — You can't intervene from fear or exhaustion, and that's
  normal given what you're dealing with. Before any conversation, take a walk, write down
  what you want to say, and step away if it heats up.
- **Co-Parent / Caregiver Alignment** — Make sure you and your co-parent are clear on the
  household rules, rewards, and consequences before approaching your child. Stay unified in
  front of them; work disagreements out privately.
- **Build Your Personal Support Group** — Join and actively post in the "Monitoring and
  Intervention discussion group." Connecting with other parents facing similar challenges
  provides insight and support. This group is an invaluable source of shared experience.

**KEY PRIORITIES**
Communication & Conflict is the most pressing area right now. Conversations are turning into
arguments, and your child is shutting down. Keep talks short and low-pressure, and point
yourself toward the Essential Workshop "Effective Communication: Building Trust and
Engagement with Your Teen." If a conversation escalates this week, the next step is to pause
and return to it calm, with the boundary already agreed on with your co-parent still standing.

**WHAT TO AVOID**
- Don't approach the conversation from a flare of fear or anger — your child sees what you
  bring into the room, not the feeling you had before walking in.
- Avoid issuing ultimatums you're not prepared to follow through on.
- Don't go it alone — isolation makes every decision harder than it needs to be.

**FIRST 72 HOURS PLAN**
- Day 1 — Ground yourself and align privately with your co-parent on rules and unified
  language. No conversation with your child yet.
- Day 2 — Join and post in the "Monitoring and Intervention discussion group." Before Day 3's
  conversation, review one Auxiliary Workshop matched to your strongest concern and the
  relevant substance facts — having the information in your head means you respond from facts,
  not fear.
- Day 3 — Have the first calm conversation: "We both know things have felt off lately — what
  do you think is going on, and how do we work on it together?"

**DAYS 4 TO 7 CONTINUATION**
- Keep daily check-ins short and consistent.
- Continue active participation in the "Monitoring and Intervention discussion group."
- If the pattern continues, an ASAP-endorsed therapist becomes the right next step. For
  guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin
  Spaces, under Treatment Providers, you can find a listing of treatment providers &
  therapists who endorse and support the ASAP program.

**ENCOURAGEMENT AND DIRECTION**
This takes determination and perseverance, and you're showing both. Remember your child is
not the opponent — the substance use is, and this is the two of you against it together.

Recovery is a journey — not a single event — and protecting the progress your child has
already made is one of the most important responsibilities you have as a parent. While many
adolescents go on to achieve lasting recovery, setbacks can occur. A setback does not erase
the progress that has been made, and it does not have to become a return to the past.

Preparation is one of your greatest strengths. We encourage you to complete the Auxiliary
Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks." It will help
you recognize early warning signs, respond calmly and effectively if challenges arise, and
strengthen your family's plan to protect your child's recovery. We also encourage you to
participate in the Protecting Recovery Discussion Group, where parents share experiences,
encouragement, and practical insights while supporting one another through the ongoing
journey of recovery.

Remember, the purpose of monitoring, supervision, conversations, and appropriate boundaries
is not simply to discover what happened or when it happened — but to understand why.
Identifying and addressing the underlying reasons for substance use gives your child the
greatest opportunity for long-term recovery and a healthy, meaningful future.
