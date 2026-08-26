# Spanish review — Monitoring & Intervention Version 1.0

**For native-speaker sign-off.** Generated from `content/` by
`scripts/spanish-review.ts` on request, so it cannot drift from what ships.
Re-run it after any content edit.

209 strings, of which 120 are the existing
questionnaire wording carried over unchanged from the live system and need no
review unless something was already wrong.

## How Spanish works here now

In the live system, English and Spanish are two separately maintained prompt
files kept in step by hand — 39 rule headings on one side, 21 on the other. After
this upgrade the rules live once, as data, with both languages side by side in the
same record. The schema requires both: a missing translation fails at boot rather
than shipping a blank section to a Spanish-speaking parent. That is what makes
this class of drift structurally hard rather than a matter of discipline.

## What stays in English, deliberately

4 strings are identical in both languages, and should be:

- **workshop category — essential** — `Essential Workshop`
- **workshop category — auxiliary** — `Auxiliary Workshop`
- **required wording "professional-help-sequence" — sentence 1** — `For guidance, consider posting questions in the Sustaining Recovery discussion group.`
- **required wording "professional-help-sequence" — sentence 2** — `In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.`

Workshop titles, discussion group names, and the two sentences of the
professional-help sequence are program resource names and locations, not prose.
They are cited verbatim in Spanish reports, per existing founder direction.

## Priority for review

Read these first — they ship **verbatim** to a parent, with no model involved:

### section "universalGuidingPrinciple" — VERBATIM TEXT

**EN**

The level of intervention should always match the level of risk. Too much intervention can be as counterproductive as too little. As concerns increase, your response should increase with them; as risk decreases, your response can adjust accordingly. The goal is not to use the strongest intervention available—it is to use the level of intervention that best matches what is actually happening with your child.

**ES**

El nivel de intervención siempre debe corresponder al nivel de riesgo. Demasiada intervención puede ser tan contraproducente como demasiado poca. A medida que las preocupaciones aumentan, tu respuesta debe aumentar con ellas; a medida que el riesgo disminuye, tu respuesta puede ajustarse en consecuencia. El objetivo no es usar la intervención más fuerte disponible — es usar el nivel de intervención que mejor corresponda a lo que realmente está pasando con tu hijo.

### section "parentSelfCare" — VERBATIM TEXT

**EN**

Taking care of yourself is not a luxury—it’s a necessity. Whether you need some quiet time, a good workout, or the support of counseling, make space for what helps you stay grounded. When you care for yourself, you will be better able to show up strong, present, and healthy for you and your family.

**ES**

Cuidarte no es un lujo — es una necesidad. Ya sea que necesites un momento de tranquilidad, un buen ejercicio o el apoyo de la consejería, haz espacio para lo que te ayuda a mantenerte con los pies en la tierra. Cuando te cuidas, puedes estar fuerte, presente y saludable para ti y para tu familia.

### section "standardizedClosing" — VERBATIM TEXT

**EN**

Recovery is a journey—not a single event—and protecting the progress your child has already made is one of the most important responsibilities you have as a parent. While many adolescents go on to achieve lasting recovery, setbacks can occur. A setback does not erase the progress that has been made, and it does not have to become a return to the past.

Preparation is one of your greatest strengths. We encourage you to complete the Auxiliary Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks." It will help you recognize early warning signs, respond calmly and effectively if challenges arise, and strengthen your family's plan to protect your child's recovery. We also encourage you to participate in the Protecting Recovery Discussion Group, where parents share experiences, encouragement, and practical insights while supporting one another through the ongoing journey of recovery.

Remember, the purpose of monitoring, supervision, conversations, and appropriate boundaries is not simply to discover what happened or when it happened—but to understand why. Identifying and addressing the underlying reasons for substance use gives your child the greatest opportunity for long-term recovery and a healthy, meaningful future.

**ES**

La recuperación es un camino, no un solo acontecimiento, y proteger el progreso que tu hijo ya ha logrado es una de las responsabilidades más importantes que tienes como padre. Aunque muchos adolescentes llegan a alcanzar una recuperación duradera, pueden ocurrir recaídas. Una recaída no borra el progreso alcanzado, y no tiene por qué convertirse en un regreso al pasado.

La preparación es una de tus mayores fortalezas. Te animamos a completar el Auxiliary Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks". Te ayudará a reconocer las señales de alerta tempranas, a responder con calma y eficacia si surgen dificultades, y a fortalecer el plan de tu familia para proteger la recuperación de tu hijo. También te animamos a participar en el Protecting Recovery Discussion Group, donde los padres comparten experiencias, aliento y conocimientos prácticos mientras se apoyan mutuamente a lo largo del camino continuo de la recuperación.

Recuerda que el propósito del monitoreo, la supervisión, las conversaciones y los límites apropiados no es simplemente descubrir qué pasó o cuándo pasó, sino entender por qué. Identificar y abordar las razones de fondo del consumo de sustancias le da a tu hijo la mayor oportunidad de lograr una recuperación a largo plazo y un futuro sano y significativo.


## Everything else

| Where | English | Spanish |
|---|---|---|
| tier "critical" — label | Critical | Crítico |
| tier "critical" — description | You told us something urgent is happening. This plan deals with that first. | Nos dijiste que está pasando algo urgente. Este plan aborda eso primero. |
| tier "serious" — label | Serious | Grave |
| tier "serious" — description | What you have described points to active use or a real safety concern. This plan moves quickly. | Lo que describes apunta a consumo activo o a una preocupación real de seguridad. Este plan avanza rápido. |
| tier "mild" — label | Mild | Leve |
| tier "mild" — description | What you are seeing looks early. This plan is about paying closer attention now, while it is still small. | Lo que estás viendo parece temprano. Este plan es para prestar más atención ahora, mientras todavía es algo pequeño. |
| tier "moderate" — label | Moderate | Moderado |
| tier "moderate" — description | There are real signals here, though not acute ones. This plan is about acting steadily and early. | Hay señales reales aquí, aunque no agudas. Este plan es para actuar con firmeza y a tiempo. |
| priority "parent-emotional-regulation" — title | Parent Emotional Regulation | Regulación emocional del padre o la madre |
| priority "parent-emotional-regulation" — intent | Before any conversation with the child, the parent steadies themselves first. What the child sees is what the parent brings into the room, not the feeling they had before walking in. In MILD this is naming the second-guessing and pausing before responding; in MODERATE it adds the tactical layer — walk, write down what you want to say, leave the room if it heats up; in SERIOUS and CRITICAL it is explicit. The step is never skipped or downgraded by severity; only the tactics change. | Antes de cualquier conversación con el hijo, el padre se regula primero. Lo que el hijo ve es lo que el padre lleva al cuarto, no el sentimiento que tuvo antes de entrar. En LEVE esto es nombrar el segundo-cuestionamiento y pausar antes de responder; en MODERADO suma la capa táctica — caminar, escribir lo que quieres decir, salir del cuarto si la cosa se calienta; en GRAVE y CRÍTICO es explícito. El paso nunca se omite ni se rebaja según la severidad; solo cambian las tácticas. |
| priority "preventative-foundation" — title | Know what you are looking at | Saber qué estás viendo |
| priority "preventative-foundation" — intent | Nothing here is acute, and the most useful thing a parent can do at this stage is learn what the early signals actually look like — so that if the picture changes they recognise it in days rather than months, and so that their attention is informed rather than anxious. | Nada de esto es agudo, y lo más útil que un padre puede hacer en esta etapa es aprender cómo se ven realmente las señales tempranas — para que si el panorama cambia lo reconozca en días y no en meses, y para que su atención esté informada en lugar de ansiosa. |
| priority "communication-breakdown" — title | When every conversation turns into a fight | Cuando cada conversación se vuelve una pelea |
| priority "communication-breakdown" — intent | Conversations that end in shouting, or that the parent avoids starting, mean the plan cannot be delivered even if it is right. Rebuilding the ability to talk is not a soft step before the real work; it is what makes every later step possible. | Las conversaciones que terminan a gritos, o que el padre evita empezar, significan que el plan no se puede ejecutar aunque sea correcto. Reconstruir la capacidad de hablar no es un paso blando antes del trabajo real; es lo que hace posible todo lo que viene después. |
| priority "co-parent-alignment" — title | Get the adults aligned | Alinear a los adultos |
| priority "co-parent-alignment" — intent | The rules, rewards and consequences only hold if the adults are saying the same thing. Align with the co-parent or co-guardian before the conversation with the child, not during it. Never framed as finding a 'trusted adult' — that phrasing is not part of this methodology. | Las reglas, las recompensas y las consecuencias solo se sostienen si los adultos dicen lo mismo. Alinea con el co-padre o co-tutor antes de la conversación con el hijo, no durante. Nunca se plantea como buscar un 'adulto de confianza' — esa frase no es parte de esta metodología. |
| priority "active-use-intervention" — title | Act on what you are seeing | Actuar sobre lo que estás viendo |
| priority "active-use-intervention" — intent | Use is confirmed or strongly suspected, so the plan moves from watching to intervening: structured first steps, a firm boundary the adults already agreed, and a named next move if the behaviour continues this week. | El consumo está confirmado o fuertemente sospechado, así que el plan pasa de observar a intervenir: primeros pasos estructurados, un límite firme ya acordado entre los adultos, y un próximo paso concreto si la conducta continúa esta semana. |
| priority "secrecy-and-hidden-use" — title | When you are not getting straight answers | Cuando no obtienes respuestas claras |
| priority "secrecy-and-hidden-use" — intent | Secrecy, lying or avoidance around questions means information has to be gathered a different way. Any search of a room, backpack or phone happens privately and without the child present — that is not a detail, it is the difference between fact-finding and a confrontation. | El secretismo, las mentiras o la evasión ante las preguntas significan que la información hay que reunirla de otra forma. Cualquier revisión del cuarto, la mochila o el celular ocurre en privado y sin que el hijo esté presente — eso no es un detalle, es la diferencia entre reunir información y una confrontación. |
| priority "peer-influence" — title | The people around your child | Las personas alrededor de tu hijo |
| priority "peer-influence" — intent | Peers the parent considers a negative influence are a route into use, and the answer is not simply forbidding friendships. The parent learns how influence and social contagion work so they can talk about it without the conversation becoming a fight about who is allowed in the house. | Los pares que el padre considera una mala influencia son una vía hacia el consumo, y la respuesta no es simplemente prohibir amistades. El padre aprende cómo funcionan la influencia y el contagio social para poder hablarlo sin que la conversación se vuelva una pelea sobre quién puede entrar a la casa. |
| priority "phone-and-social-media" — title | The phone and what is on it | El celular y lo que hay en él |
| priority "phone-and-social-media" — intent | Unmonitored phone and social-media access alongside negative peer influence is a supply line and a pressure source at once. Supervision that is explained holds; supervision that arrives as a punishment does not. | El acceso sin supervisión al celular y a las redes, junto con la influencia de pares negativos, es a la vez una vía de suministro y una fuente de presión. La supervisión que se explica se sostiene; la que llega como castigo no. |
| priority "healthy-home-environment" — title | Put the structure back | Recuperar la estructura |
| priority "healthy-home-environment" — intent | A day with little routine, or a home the parent is not confident discourages use, leaves rules and consequences nothing to attach to. Rebuilding predictable structure — sleep, school, meals, a home where substances are simply not available — is not cosmetic; it is the frame that makes every boundary in this plan enforceable. | Un día con poca rutina, o un hogar que el padre no está seguro de que desaliente el consumo, no deja nada a lo que las reglas y las consecuencias puedan sujetarse. Reconstruir una estructura predecible — sueño, escuela, comidas, un hogar donde las sustancias simplemente no estén disponibles — no es cosmético; es el marco que hace aplicable cada límite de este plan. |
| priority "school-engagement" — title | Bring the school in | Involucrar a la escuela |
| priority "school-engagement" — intent | School staff see hours of the child's day that the parent does not, and engaging them is one of the most important parts of building the network around the child. This is a partnership to build, not a complaint to make. | El personal escolar ve horas del día del hijo que el padre no ve, e involucrarlo es una de las partes más importantes de construir la red alrededor del hijo. Esto es una alianza que se construye, no una queja que se presenta. |
| priority "mood-and-mental-health" — title | What is underneath the behaviour | Lo que hay debajo de la conducta |
| priority "mood-and-mental-health" — intent | Mood swings, withdrawal, aggression, or a child who cannot talk about stress are signals in their own right, and often the reason use started. Treating the behaviour without the cause leaves the cause in place. | Los cambios de ánimo, el aislamiento, la agresividad, o un hijo que no puede hablar del estrés son señales por sí mismas, y a menudo la razón por la que empezó el consumo. Tratar la conducta sin la causa deja la causa intacta. |
| priority "consistent-consequences" — title | Make the rules mean something | Hacer que las reglas signifiquen algo |
| priority "consistent-consequences" — intent | Rules that are enforced sometimes teach that they are negotiable. Rewards and consequences travel together — consequences alone do not change behaviour — and both are agreed with the co-parent before they are announced. | Las reglas que se aplican a veces enseñan que son negociables. Las recompensas y las consecuencias van juntas — las consecuencias solas no cambian la conducta — y ambas se acuerdan con el co-padre antes de anunciarlas. |
| priority "parent-support-and-exhaustion" — title | You cannot do this on empty | No puedes con esto estando vacío |
| priority "parent-support-and-exhaustion" — intent | Exhaustion, fear and isolation do some of the talking in a conversation with a child, whether or not the parent intends it. Peer support is not a comfort measure here; it is what keeps the plan executable. | El agotamiento, el miedo y el aislamiento hablan por sí solos en una conversación con un hijo, lo quiera el padre o no. El apoyo entre pares no es un consuelo aquí; es lo que mantiene el plan ejecutable. |
| priority "drug-testing-serious" — title | Know what you are dealing with | Saber a qué te enfrentas |
| priority "drug-testing-serious" — intent | With use confirmed and the situation serious, the parent needs to know what is actually being used rather than guessing. A test the parent administers, framed as fact-finding, is a firm structured step for the back half of the first week — not a punishment and not a threat. | Con el consumo confirmado y la situación grave, el padre necesita saber qué se está consumiendo en realidad en lugar de adivinar. Una prueba que el padre administra, planteada como recolección de hechos, es un paso firme y estructurado para la segunda mitad de la primera semana — no un castigo ni una amenaza. |
| section "urgentConcern" — title | What you told us, first | Lo que nos dijiste, primero |
| section "urgentConcern" — instruction | Open by addressing what the parent wrote in the urgent field, in their own terms, before anything else in the plan. Name the specific thing they reported. Do not restate their words as a quotation and do not soften them. If they described something that may have been ingested, the first action is the medical one. Never call an unidentified substance 'pills' — it may be a pressed pill, a powder, a vape, an edible, or something they cannot identify, and narrowing it narrows their vigilance. | Abre abordando lo que el padre escribió en el campo urgente, en sus propios términos, antes que cualquier otra cosa del plan. Nombra lo específico que reportó. No repitas sus palabras como una cita y no las suavices. Si describió algo que pudo haber sido consumido, la primera acción es la médica. Nunca llames 'pastillas' a una sustancia no identificada — puede ser una pastilla prensada, un polvo, un vape, un comestible, o algo que no puede identificar, y limitarlo limita su vigilancia. |
| section "headlineSummary" — title | Where you are right now | Dónde estás ahora mismo |
| section "headlineSummary" — instruction | Say plainly what the answers describe, tied to what the parent actually reported rather than to scores. Reflect their situation back so they recognise it. Do not open with generic empathy, and do not quote the answer labels — those are intake-form options, not speech. Translate them into natural description: 'the near-daily exhaustion you described', not 'your "Near-daily — running on empty" exhaustion'. | Di con claridad lo que describen las respuestas, ligado a lo que el padre realmente reportó y no a los puntajes. Refleja su situación de vuelta para que la reconozca. No abras con empatía genérica, y no cites las etiquetas de respuesta — son opciones de un formulario, no habla. Tradúcelas a descripción natural: 'el agotamiento casi diario que describiste', no 'tu agotamiento "Casi diario — sin energía"'. |
| section "topImmediatePriorities" — title | Your first three priorities | Tus tres primeras prioridades |
| section "topImmediatePriorities" — instruction | Exactly three, in this order and no other. (1) The parent steadies themselves first — never a conversation-with-child action. (2) Get the adults aligned: the co-parent, co-guardian, or another parent or guardian on the family side. Never the phrase 'trusted adult'. (3) The parent's own support: name the Monitoring and Intervention discussion group, using action language — 'join the' or 'reach out to', never passive. Phrase all three directly and tied to real behaviour, not as soft coaching. Where consequences come up, rewards come up in the same breath. | Exactamente tres, en este orden y ningún otro. (1) El padre se regula primero — nunca una acción de conversación-con-el-hijo. (2) Alinear a los adultos: el co-padre, co-tutor, u otro padre o tutor del lado familiar. Nunca la frase 'adulto de confianza'. (3) El apoyo del propio padre: nombra el Monitoring and Intervention discussion group, con lenguaje de acción — 'únete al' o 'acércate al', nunca pasivo. Formula las tres de forma directa y ligada a conductas reales, no como coaching blando. Donde aparezcan las consecuencias, aparecen las recompensas en la misma frase. |
| section "keyPriorities" — title | What to work on | En qué trabajar |
| section "keyPriorities" — instruction | One entry per priority area you have been given, in the order given. Write to that area's stated intent — do not substitute your own advice, and do not merge two areas into one. Each entry ends by citing its workshops by their exact full titles, with the correct category label. Each entry also ends with a concrete trigger: 'if [specific behaviour] continues this week, the next step is [named action]'. Never end on 'monitor and reassess' or 'see how it goes'. | Una entrada por cada área de prioridad que te fue dada, en el orden dado. Escribe hacia la intención declarada de esa área — no sustituyas con tus propios consejos, y no fusiones dos áreas en una. Cada entrada termina citando sus workshops por su título exacto completo, con la etiqueta de categoría correcta. Cada entrada también termina con un disparador concreto: 'si [conducta específica] continúa esta semana, el próximo paso es [acción nombrada]'. Nunca termines con 'observa y vuelve a evaluar' ni 'a ver cómo va'. |
| section "whatToAvoid" — title | What to avoid | Qué evitar |
| section "whatToAvoid" — instruction | Three to five things this particular parent is at risk of doing, given what they reported — not a generic list. Never write 'avoid searching your child's room': a search done the ASAP way is encouraged, and only the confrontational version is discouraged. Say 'do not search your child's room, backpack, or phone confrontationally' instead. | Entre tres y cinco cosas que este padre en particular está en riesgo de hacer, dado lo que reportó — no una lista genérica. Nunca escribas 'evita revisar el cuarto de tu hijo': una revisión hecha al estilo ASAP está alentada, y solo se desalienta la versión confrontativa. Di 'no revises el cuarto, la mochila o el celular de tu hijo de manera confrontativa'. |
| section "first72Hours" — title | Your first 72 hours | Tus primeras 72 horas |
| section "first72Hours" — instruction | Day 1, Day 2 and Day 3, in that order and clearly labelled. Day 1 opens with the parent's own regulation. Day 2 is information-gathering and support, and includes an explicit instruction to review the workshop matched to the strongest concern — cited by exact title — plus the relevant substance facts, BEFORE Day 3's conversation with the child. Day 3 is that conversation. The sequence never inverts: regulation, then adult alignment, then information, then the conversation. The conversation is the last step of the first week, not the first. | Día 1, Día 2 y Día 3, en ese orden y claramente etiquetados. El Día 1 abre con la regulación del propio padre. El Día 2 es reunir información y apoyo, e incluye una instrucción explícita de revisar el workshop que coincide con la preocupación más fuerte — citado por título exacto — más los hechos relevantes sobre la sustancia, ANTES de la conversación del Día 3 con el hijo. El Día 3 es esa conversación. La secuencia nunca se invierte: regulación, luego alineación de los adultos, luego información, luego la conversación. La conversación es el último paso de la primera semana, no el primero. |
| section "days4to7" — title | Days 4 to 7 | Días 4 a 7 |
| section "days4to7" — instruction | What happens after the conversation, including at least one firm structured next step. Assume the child denied, deflected or escalated, and say what the parent does then — the boundary the adults already agreed stands. Where professional help belongs at this severity, recommend it directly rather than as something to prepare for one day. | Qué pasa después de la conversación, incluyendo al menos un próximo paso firme y estructurado. Asume que el hijo negó, esquivó o escaló, y di qué hace el padre entonces — el límite que los adultos ya acordaron se mantiene. Donde la ayuda profesional corresponda a esta severidad, recomiéndala directamente, no como algo para lo que prepararse algún día. |
| section "consideringInpatient" — title | If you are weighing inpatient or residential care | Si estás considerando tratamiento interno o residencial |
| section "consideringInpatient" — instruction | What inpatient and intensive outpatient programmes actually involve, what makes a family ready to consider one, and what the immediate next step is. Recommend it as a decision to make with a professional, not one to make from this plan — and when you name that professional, the professional-help sequence follows in the same paragraph. | Qué implican realmente los programas internos y los intensivos ambulatorios, qué hace que una familia esté lista para considerar uno, y cuál es el próximo paso inmediato. Recomiéndalo como una decisión a tomar con un profesional, no una a tomar desde este plan — y cuando nombres a ese profesional, la secuencia de ayuda profesional sigue en el mismo párrafo. |
| section "recommendedWorkshops" — title | The workshops for your situation | Los workshops para tu situación |
| section "recommendedWorkshops" — instruction | One entry per workshop you have been given, in the order given, using the exact title supplied. For each, one or two sentences on why THIS family in particular should attend it — referring to what they reported, not to the workshop's general topic. Do not add a workshop, do not omit one, and do not rename one. | Una entrada por cada workshop que te fue dado, en el orden dado, usando el título exacto suministrado. Para cada uno, una o dos oraciones sobre por qué ESTA familia en particular debería asistir — refiriéndote a lo que reportó, no al tema general del workshop. No agregues un workshop, no omitas ninguno, y no renombres ninguno. |
| section "universalGuidingPrinciple" — title | Match the Intervention to the Risk | Ajustar la intervención al riesgo |
| section "parentSelfCare" — title | Taking Care of Yourself | Cuidar de ti |
| section "encouragement" — title | Where this can go | Hacia dónde puede ir esto |
| section "encouragement" — instruction | Grounded encouragement tied to something this parent actually did or reported — never generic reassurance. Reinforce that the child is not the opponent; the substance is. Reinforce that the ASAP discussion groups are a real source of support and shared experience. Reinforce that they and their child are on the same side of this. | Aliento con los pies en la tierra, ligado a algo que este padre realmente hizo o reportó — nunca consuelo genérico. Refuerza que el hijo no es el oponente; la sustancia lo es. Refuerza que los ASAP discussion groups son una fuente real de apoyo y experiencia compartida. Refuerza que él y su hijo están del mismo lado de esto. |
| section "standardizedClosing" — title | Protecting the progress | Proteger el progreso |
| assessment — title | Monitoring & Intervention — Family Risk Assessment & Action Plan | Monitoreo e Intervención — Evaluación de Riesgo Familiar y Plan de Acción |
| assessment — intro | Twenty-four questions about what you are seeing at home. There are no right answers, and nothing here is a diagnosis — the more honest the answers, the more useful the plan. | Veinticuatro preguntas sobre lo que estás viendo en casa. No hay respuestas correctas, y nada de esto es un diagnóstico — cuanto más honestas sean las respuestas, más útil será el plan. |
| q01 — prompt | How certain are you that your child has used drugs, alcohol, or other substances? | ¿Qué tan seguro estás de que tu hijo ha consumido drogas, alcohol u otras sustancias? |
| q01 — option 1 | Confident they haven't | Seguro que no |
| q01 — option 2 | Not sure, but I don't think so | No estoy seguro, pero creo que no |
| q01 — option 3 | Strongly suspect | Lo sospecho fuertemente |
| q01 — option 4 | Confirmed or seen direct evidence | Confirmado o he visto evidencia directa |
| q02 — prompt | How frequently do you suspect substance use may be occurring? | ¿Con qué frecuencia sospechas que puede estar ocurriendo consumo de sustancias? |
| q02 — option 1 | Never | Nunca |
| q02 — option 2 | Once or twice, isolated | Una o dos veces, aislado |
| q02 — option 3 | A few times a month | Varias veces al mes |
| q02 — option 4 | Weekly or more | Semanalmente o más |
| q03 — prompt | Have you observed secrecy, lying, or avoidance when discussing concerns? | ¿Has notado secretismo, mentiras o evasión cuando intentas hablar de lo que te preocupa? |
| q03 — option 1 | No — open and honest | No — abierto y honesto |
| q03 — option 2 | Occasionally evasive | A veces evasivo |
| q03 — option 3 | Often secretive or avoidant | Frecuentemente secretista o evasivo |
| q03 — option 4 | Constantly — won't engage at all | Constantemente — no se abre en absoluto |
| q04 — prompt | How often does your child spend time in environments where substances may be present? | ¿Con qué frecuencia tu hijo pasa tiempo en entornos donde puede haber sustancias? |
| q04 — option 1 | Rarely or never | Rara vez o nunca |
| q04 — option 2 | Occasionally | Ocasionalmente |
| q04 — option 3 | Often — most weekends | A menudo — la mayoría de los fines de semana |
| q04 — option 4 | Most of their free time | La mayor parte de su tiempo libre |
| q05 — prompt | How intense are conflicts between you and your child regarding behavior or rules? | ¿Qué tan intensos son los conflictos entre tú y tu hijo respecto al comportamiento o las reglas? |
| q05 — option 1 | Calm — disagreements resolve easily | Calmados — los desacuerdos se resuelven fácilmente |
| q05 — option 2 | Occasional tension | Tensión ocasional |
| q05 — option 3 | Frequent arguments | Discusiones frecuentes |
| q05 — option 4 | Yelling, slamming doors, near-daily | Gritos, portazos, casi a diario |
| q06 — prompt | How confident do you feel confronting your child about substance concerns? | ¿Qué tan preparado te sientes para confrontar a tu hijo sobre tus preocupaciones de consumo? |
| q06 — option 1 | Confident — I know what to say | Preparado — sé qué decir |
| q06 — option 2 | Somewhat confident | Algo preparado |
| q06 — option 3 | Unsure how to approach it | No sé cómo abordarlo |
| q06 — option 4 | Avoid it entirely — dread the conversation | Lo evito — me angustia la conversación |
| q07 — prompt | How consistent are consequences when rules are broken? | ¿Qué tan consistentes son las consecuencias cuando se rompen las reglas? |
| q07 — option 1 | Always consistent | Siempre consistentes |
| q07 — option 2 | Mostly consistent | Casi siempre consistentes |
| q07 — option 3 | Inconsistent | Inconsistentes |
| q07 — option 4 | Rules rarely or never enforced | Rara vez o nunca se aplican |
| q08 — prompt | How often do you feel unsure whether you are overreacting or underreacting? | ¿Con qué frecuencia dudas si estás reaccionando de más o de menos? |
| q08 — option 1 | Almost never | Casi nunca |
| q08 — option 2 | Occasionally | Ocasionalmente |
| q08 — option 3 | Often — second-guess most of the time | A menudo — dudo la mayor parte del tiempo |
| q08 — option 4 | Constantly — paralyzed by doubt | Constantemente — paralizado por la duda |
| q09 — prompt | Have you noticed significant mood swings, withdrawal, or aggressive behavior? | ¿Has notado cambios importantes de ánimo, aislamiento o conductas agresivas? |
| q09 — option 1 | No noticeable change | Sin cambios notables |
| q09 — option 2 | Mild changes | Cambios leves |
| q09 — option 3 | Clear and frequent changes | Cambios claros y frecuentes |
| q09 — option 4 | Dramatic or near-daily changes | Cambios dramáticos o casi a diario |
| q10 — prompt | How concerned are you about your child's safety (driving, risky environments, etc.)? | ¿Qué tan preocupado estás por la seguridad de tu hijo (al conducir, entornos de riesgo, etc.)? |
| q10 — option 1 | Not concerned | No me preocupa |
| q10 — option 2 | Mildly concerned | Levemente preocupado |
| q10 — option 3 | Serious concern | Preocupación seria |
| q10 — option 4 | Active fear — lose sleep over it | Miedo activo — pierdo el sueño |
| q11 — prompt | How aligned are caregivers or co-parents in responding to the situation? | ¿Qué tan alineados están los cuidadores o co-padres al responder a esta situación? |
| q11 — option 1 | Fully aligned — same page on rules and tone | Totalmente alineados — mismo criterio en reglas y tono |
| q11 — option 2 | Mostly aligned | Mayormente alineados |
| q11 — option 3 | Disagree often | En desacuerdo a menudo |
| q11 — option 4 | Pulling in opposite directions, or no co-parent contact | Cada uno por su lado, o sin contacto con el co-padre |
| q12 — prompt | How often does your child spend time with peers you consider a negative influence? | ¿Con qué frecuencia tu hijo pasa tiempo con compañeros que consideras una mala influencia? |
| q12 — option 1 | Rarely or never | Rara vez o nunca |
| q12 — option 2 | Some peers I worry about | Algunos compañeros me preocupan |
| q12 — option 3 | Most of their friends are concerning | La mayoría de sus amigos son preocupantes |
| q12 — option 4 | Almost exclusively with peers I distrust | Casi exclusivamente con compañeros en los que no confío |
| q13 — prompt | How comfortable is your child discussing stress, anxiety, or emotional pain? | ¿Qué tan cómodo se siente tu hijo al hablar de estrés, ansiedad o dolor emocional? |
| q13 — option 1 | Very comfortable — talks openly | Muy cómodo — habla abiertamente |
| q13 — option 2 | Sometimes shares | A veces comparte |
| q13 — option 3 | Rarely shares | Rara vez comparte |
| q13 — option 4 | Shuts down completely — won't engage | Se cierra por completo — no se abre |
| q14 — prompt | How frequently do you monitor your child's whereabouts and activities? | ¿Con qué frecuencia monitoreas dónde está y qué hace tu hijo? |
| q14 — option 1 | Consistently — always know | Consistentemente — siempre sé |
| q14 — option 2 | Most of the time | La mayor parte del tiempo |
| q14 — option 3 | Often unsure | A menudo no estoy seguro |
| q14 — option 4 | Rarely know where they are | Rara vez sé dónde está |
| q15 — prompt | How supported do you feel by school staff or community professionals? | ¿Qué tan apoyado te sientes por el personal escolar o profesionales de la comunidad? |
| q15 — option 1 | Very supported — actively in touch with school / coaches | Muy apoyado — en contacto activo con la escuela / entrenadores |
| q15 — option 2 | Some support | Algo de apoyo |
| q15 — option 3 | Limited support | Apoyo limitado |
| q15 — option 4 | Feel alone — no school or community contact | Me siento solo — sin contacto con la escuela ni la comunidad |
| q16 — prompt | Have you sought guidance from a therapist, counselor, or treatment provider? | ¿Has buscado orientación con un terapeuta, consejero o proveedor de tratamiento? |
| q16 — option 1 | Yes, currently working with one | Sí, trabajando con uno actualmente |
| q16 — option 2 | Reached out, exploring options | He buscado, explorando opciones |
| q16 — option 3 | Considered but haven't yet | Lo he considerado pero aún no |
| q16 — option 4 | No — wouldn't know where to start | No — no sabría por dónde empezar |
| q17 — prompt | How often do you feel exhausted, fearful, or overwhelmed by the situation? | ¿Con qué frecuencia te sientes agotado, con miedo o abrumado por la situación? |
| q17 — option 1 | Rarely or never | Rara vez o nunca |
| q17 — option 2 | Occasionally | Ocasionalmente |
| q17 — option 3 | Often — most weeks | A menudo — la mayoría de las semanas |
| q17 — option 4 | Near-daily — running on empty | Casi a diario — sin combustible |
| q18 — prompt | How clear is your plan for next steps if substance use continues? | ¿Qué tan claro tienes el plan de próximos pasos si el consumo continúa? |
| q18 — option 1 | Very clear — written plan aligned with co-parent | Muy claro — plan escrito alineado con el co-padre |
| q18 — option 2 | Some idea, not detailed | Una idea, no detallada |
| q18 — option 3 | Unsure what to do next | No sé qué hacer |
| q18 — option 4 | No plan at all | Sin plan alguno |
| q19 — prompt | How often does your child accept responsibility for their behavior? | ¿Con qué frecuencia tu hijo asume responsabilidad por su comportamiento? |
| q19 — option 1 | Owns mistakes consistently | Asume sus errores consistentemente |
| q19 — option 2 | Sometimes | A veces |
| q19 — option 3 | Rarely | Rara vez |
| q19 — option 4 | Never — blames others or denies | Nunca — culpa a otros o niega |
| q20 — prompt | How much structure currently exists in your child's daily routine? | ¿Cuánta estructura existe actualmente en la rutina diaria de tu hijo? |
| q20 — option 1 | Strong routine — sleep, school, meals, activities | Rutina sólida — sueño, escuela, comidas, actividades |
| q20 — option 2 | Some structure, gaps in places | Algo de estructura, con vacíos |
| q20 — option 3 | Inconsistent | Inconsistente |
| q20 — option 4 | Little or no structure | Poca o ninguna estructura |
| q21 — prompt | How confident are you that your home environment discourages substance use? | ¿Qué tan seguro estás de que el ambiente en casa desalienta el consumo de sustancias? |
| q21 — option 1 | Very confident — clear rules, no access, aligned messaging | Muy seguro — reglas claras, sin acceso, mensaje alineado |
| q21 — option 2 | Mostly confident | Mayormente seguro |
| q21 — option 3 | Unsure | No estoy seguro |
| q21 — option 4 | Concerned — access, exposure, or mixed messages at home | Preocupado — acceso, exposición o mensajes mixtos en casa |
| q22 — prompt | How prepared do you feel to set firm but supportive boundaries? | ¿Qué tan preparado te sientes para establecer límites firmes pero con apoyo? |
| q22 — option 1 | Fully prepared | Totalmente preparado |
| q22 — option 2 | Somewhat prepared | Algo preparado |
| q22 — option 3 | Uncertain how to balance firm and supportive | Inseguro de cómo equilibrar firmeza y apoyo |
| q22 — option 4 | Don't know where to begin | No sé por dónde empezar |
| q23 — prompt | How frequently do you worry about long-term consequences if patterns continue? | ¿Con qué frecuencia te preocupan las consecuencias a largo plazo si los patrones continúan? |
| q23 — option 1 | Rarely | Rara vez |
| q23 — option 2 | Occasionally | Ocasionalmente |
| q23 — option 3 | Often | A menudo |
| q23 — option 4 | Constantly — affects sleep, work, or daily mood | Constantemente — me afecta el sueño, el trabajo o el ánimo |
| q24 — prompt | How ready are you to take decisive action to protect your child's well-being? | ¿Qué tan listo estás para actuar con decisión y proteger el bienestar de tu hijo? |
| q24 — option 1 | Ready now — committed to act | Listo ahora — comprometido a actuar |
| q24 — option 2 | Mostly ready | Mayormente listo |
| q24 — option 3 | Hesitant | Vacilante |
| q24 — option 4 | Stuck — don't know what to do | Atascado — no sé qué hacer |
| urgent field — label | Is there anything urgent you want to tell us? | ¿Hay algo urgente que quieras contarnos? |
| urgent field — help | Optional. If something has just happened — you found something, or your child may have taken something — tell us here and the plan will address it first. | Opcional. Si algo acaba de pasar — encontraste algo, o tu hijo pudo haber consumido algo — cuéntanoslo aquí y el plan lo abordará primero. |
| urgent field — placeholder | What happened, and when? | ¿Qué pasó, y cuándo? |
| required wording "professional-help-sequence" — trigger terms | therapist, treatment provider, treatment center, professional help, ASAP-endorsed, clinician, treatment program | terapeuta, proveedor de tratamiento, centro de tratamiento, ayuda profesional, ASAP-endorsed, clínico, programa de tratamiento |
| required wording "private-search-line" — sentence 1 | Conduct any search of your child's room, backpack, or phone privately and without your child present. | Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente. |
| required wording "private-search-line" — sentence 2 | Leave the room as you found it and document anything relevant. | Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante. |
| required wording "private-search-line" — trigger terms | search, searching, backpack | revisión, revisar, mochila |
| required wording "standardized-closing" — sentence 1 | Recovery is a journey—not a single event—and protecting the progress your child has already made is one of the most important responsibilities you have as a parent. While many adolescents go on to achieve lasting recovery, setbacks can occur. A setback does not erase the progress that has been made, and it does not have to become a return to the past. | La recuperación es un camino, no un solo acontecimiento, y proteger el progreso que tu hijo ya ha logrado es una de las responsabilidades más importantes que tienes como padre. Aunque muchos adolescentes llegan a alcanzar una recuperación duradera, pueden ocurrir recaídas. Una recaída no borra el progreso alcanzado, y no tiene por qué convertirse en un regreso al pasado. |
| required wording "standardized-closing" — sentence 2 | Preparation is one of your greatest strengths. We encourage you to complete the Auxiliary Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks." It will help you recognize early warning signs, respond calmly and effectively if challenges arise, and strengthen your family's plan to protect your child's recovery. We also encourage you to participate in the Protecting Recovery Discussion Group, where parents share experiences, encouragement, and practical insights while supporting one another through the ongoing journey of recovery. | La preparación es una de tus mayores fortalezas. Te animamos a completar el Auxiliary Workshop "Protecting Recovery: Preventing Relapse and Responding to Setbacks". Te ayudará a reconocer las señales de alerta tempranas, a responder con calma y eficacia si surgen dificultades, y a fortalecer el plan de tu familia para proteger la recuperación de tu hijo. También te animamos a participar en el Protecting Recovery Discussion Group, donde los padres comparten experiencias, aliento y conocimientos prácticos mientras se apoyan mutuamente a lo largo del camino continuo de la recuperación. |
| required wording "standardized-closing" — sentence 3 | Remember, the purpose of monitoring, supervision, conversations, and appropriate boundaries is not simply to discover what happened or when it happened—but to understand why. Identifying and addressing the underlying reasons for substance use gives your child the greatest opportunity for long-term recovery and a healthy, meaningful future. | Recuerda que el propósito del monitoreo, la supervisión, las conversaciones y los límites apropiados no es simplemente descubrir qué pasó o cuándo pasó, sino entender por qué. Identificar y abordar las razones de fondo del consumo de sustancias le da a tu hijo la mayor oportunidad de lograr una recuperación a largo plazo y un futuro sano y significativo. |
| required wording "standardized-closing" — trigger terms | Recovery is a journey | La recuperación es un camino |
| domain "immediate-safety-urgency" — label | Immediate Safety & Urgency | Seguridad inmediata y urgencia |
| domain "immediate-safety-urgency" — description | How much direct evidence of use there is, how often it may be happening, and how exposed your child is to immediate physical risk. | Cuánta evidencia directa de consumo existe, con qué frecuencia puede estar ocurriendo, y qué tan expuesto está tu hijo a un riesgo físico inmediato. |
| domain "household-structure" — label | Household Structure | Estructura del hogar |
| domain "household-structure" — description | How much routine, supervision and predictability the home currently provides. | Cuánta rutina, supervisión y previsibilidad ofrece hoy el hogar. |
| domain "boundary-consistency" — label | Boundary Consistency | Consistencia de los límites |
| domain "boundary-consistency" — description | Whether rules, rewards and consequences are applied the same way each time, and whether the adults are aligned on them. | Si las reglas, las recompensas y las consecuencias se aplican igual cada vez, y si los adultos están alineados en ellas. |
| domain "communication-conflict" — label | Communication & Conflict | Comunicación y conflicto |
| domain "communication-conflict" — description | How conversations about behaviour are going, and how much secrecy or conflict sits between you. | Cómo van las conversaciones sobre el comportamiento, y cuánto secretismo o conflicto hay entre ustedes. |
| domain "support-professional-engagement" — label | Support & Professional Engagement | Apoyo y participación profesional |
| domain "support-professional-engagement" — description | How much help you have around you — school, community, professionals — and how supported you feel carrying this. | Cuánta ayuda tienes a tu alrededor — escuela, comunidad, profesionales — y qué tan apoyado te sientes al cargar con esto. |

---

*Corrections can be made directly in `content/` — every string above is a JSON
edit, and none requires a code change.*
