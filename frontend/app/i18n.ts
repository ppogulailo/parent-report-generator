export type Language = 'en' | 'es';

export const QUESTIONS: Record<Language, string[]> = {
  en: [
    'How certain are you that your child has used drugs, alcohol, or other substances?',
    'How frequently do you suspect substance use may be occurring?',
    'Have you observed secrecy, lying, or avoidance when discussing concerns?',
    'How often does your child spend time in environments where substances may be present?',
    'How intense are conflicts between you and your child regarding behavior or rules?',
    'How confident do you feel confronting your child about substance concerns?',
    'How consistent are consequences when rules are broken?',
    'How often do you feel unsure whether you are overreacting or underreacting?',
    'Have you noticed significant mood swings, withdrawal, or aggressive behavior?',
    'How concerned are you about your child’s safety (driving, risky environments, etc.)?',
    'How aligned are caregivers or co-parents in responding to the situation?',
    'How often does your child spend time with peers you consider a negative influence?',
    'How comfortable is your child discussing stress, anxiety, or emotional pain?',
    'How frequently do you monitor your child’s whereabouts and activities?',
    'How supported do you feel by school staff or community professionals?',
    'Have you sought guidance from a therapist, counselor, or treatment provider?',
    'How often do you feel exhausted, fearful, or overwhelmed by the situation?',
    'How clear is your plan for next steps if substance use continues?',
    'How often does your child accept responsibility for their behavior?',
    'How much structure currently exists in your child’s daily routine?',
    'How confident are you that your home environment discourages substance use?',
    'How prepared do you feel to set firm but supportive boundaries?',
    'How frequently do you worry about long-term consequences if patterns continue?',
    'How ready are you to take decisive action to protect your child’s well-being?',
  ],
  es: [
    '¿Qué tan seguro estás de que tu hijo ha consumido drogas, alcohol u otras sustancias?',
    '¿Con qué frecuencia sospechas que puede estar ocurriendo consumo de sustancias?',
    '¿Has notado secretismo, mentiras o evasión cuando intentas hablar de lo que te preocupa?',
    '¿Con qué frecuencia tu hijo pasa tiempo en entornos donde puede haber sustancias?',
    '¿Qué tan intensos son los conflictos entre tú y tu hijo respecto al comportamiento o las reglas?',
    '¿Qué tan preparado te sientes para confrontar a tu hijo sobre tus preocupaciones de consumo?',
    '¿Qué tan consistentes son las consecuencias cuando se rompen las reglas?',
    '¿Con qué frecuencia dudas si estás reaccionando de más o de menos?',
    '¿Has notado cambios importantes de ánimo, aislamiento o conductas agresivas?',
    '¿Qué tan preocupado estás por la seguridad de tu hijo (al conducir, entornos de riesgo, etc.)?',
    '¿Qué tan alineados están los cuidadores o co-padres al responder a esta situación?',
    '¿Con qué frecuencia tu hijo pasa tiempo con compañeros que consideras una mala influencia?',
    '¿Qué tan cómodo se siente tu hijo al hablar de estrés, ansiedad o dolor emocional?',
    '¿Con qué frecuencia monitoreas dónde está y qué hace tu hijo?',
    '¿Qué tan apoyado te sientes por el personal escolar o profesionales de la comunidad?',
    '¿Has buscado orientación con un terapeuta, consejero o proveedor de tratamiento?',
    '¿Con qué frecuencia te sientes agotado, con miedo o abrumado por la situación?',
    '¿Qué tan claro tienes el plan de próximos pasos si el consumo continúa?',
    '¿Con qué frecuencia tu hijo asume responsabilidad por su comportamiento?',
    '¿Cuánta estructura existe actualmente en la rutina diaria de tu hijo?',
    '¿Qué tan seguro estás de que el ambiente en casa desalienta el consumo de sustancias?',
    '¿Qué tan preparado te sientes para establecer límites firmes pero con apoyo?',
    '¿Con qué frecuencia te preocupan las consecuencias a largo plazo si los patrones continúan?',
    '¿Qué tan listo estás para actuar con decisión y proteger el bienestar de tu hijo?',
  ],
};

// Per-question behavior anchors, mirroring src/report/prompts/questions{,.es}.ts.
// ANSWER_LABELS[lang][questionIndex][scoreIndex - 1] gives the label for that
// question + chosen score. 1 always = strength end, 4 always = concern end —
// the labels carry the direction so the parent never has to translate.
export const ANSWER_LABELS: Record<Language, string[][]> = {
  en: [
    // Q1
    [
      "Confident they haven't",
      "Not sure, but I don't think so",
      'Strongly suspect',
      'Confirmed or seen direct evidence',
    ],
    // Q2
    [
      'Never',
      'Once or twice, isolated',
      'A few times a month',
      'Weekly or more',
    ],
    // Q3
    [
      'No — open and honest',
      'Occasionally evasive',
      'Often secretive or avoidant',
      "Constantly — won't engage at all",
    ],
    // Q4
    [
      'Rarely or never',
      'Occasionally',
      'Often — most weekends',
      'Most of their free time',
    ],
    // Q5
    [
      'Calm — disagreements resolve easily',
      'Occasional tension',
      'Frequent arguments',
      'Yelling, slamming doors, near-daily',
    ],
    // Q6
    [
      'Confident — I know what to say',
      'Somewhat confident',
      'Unsure how to approach it',
      'Avoid it entirely — dread the conversation',
    ],
    // Q7
    [
      'Always consistent',
      'Mostly consistent',
      'Inconsistent',
      'Rules rarely or never enforced',
    ],
    // Q8
    [
      'Almost never',
      'Occasionally',
      'Often — second-guess most of the time',
      'Constantly — paralyzed by doubt',
    ],
    // Q9
    [
      'No noticeable change',
      'Mild changes',
      'Clear and frequent changes',
      'Dramatic or near-daily changes',
    ],
    // Q10
    [
      'Not concerned',
      'Mildly concerned',
      'Serious concern',
      'Active fear — lose sleep over it',
    ],
    // Q11
    [
      'Fully aligned — same page on rules and tone',
      'Mostly aligned',
      'Disagree often',
      'Pulling in opposite directions, or no co-parent contact',
    ],
    // Q12
    [
      'Rarely or never',
      'Some peers I worry about',
      'Most of their friends are concerning',
      'Almost exclusively with peers I distrust',
    ],
    // Q13
    [
      'Very comfortable — talks openly',
      'Sometimes shares',
      'Rarely shares',
      "Shuts down completely — won't engage",
    ],
    // Q14
    [
      'Consistently — always know',
      'Most of the time',
      'Often unsure',
      'Rarely know where they are',
    ],
    // Q15
    [
      'Very supported — actively in touch with school / coaches',
      'Some support',
      'Limited support',
      'Feel alone — no school or community contact',
    ],
    // Q16
    [
      'Yes, currently working with one',
      'Reached out, exploring options',
      "Considered but haven't yet",
      "No — wouldn't know where to start",
    ],
    // Q17
    [
      'Rarely or never',
      'Occasionally',
      'Often — most weeks',
      'Near-daily — running on empty',
    ],
    // Q18
    [
      'Very clear — written plan aligned with co-parent',
      'Some idea, not detailed',
      'Unsure what to do next',
      'No plan at all',
    ],
    // Q19
    [
      'Owns mistakes consistently',
      'Sometimes',
      'Rarely',
      'Never — blames others or denies',
    ],
    // Q20
    [
      'Strong routine — sleep, school, meals, activities',
      'Some structure, gaps in places',
      'Inconsistent',
      'Little or no structure',
    ],
    // Q21
    [
      'Very confident — clear rules, no access, aligned messaging',
      'Mostly confident',
      'Unsure',
      'Concerned — access, exposure, or mixed messages at home',
    ],
    // Q22
    [
      'Fully prepared',
      'Somewhat prepared',
      'Uncertain how to balance firm and supportive',
      "Don't know where to begin",
    ],
    // Q23
    [
      'Rarely',
      'Occasionally',
      'Often',
      'Constantly — affects sleep, work, or daily mood',
    ],
    // Q24
    [
      'Ready now — committed to act',
      'Mostly ready',
      'Hesitant',
      "Stuck — don't know what to do",
    ],
  ],
  es: [
    // Q1
    [
      'Seguro que no',
      'No estoy seguro, pero creo que no',
      'Lo sospecho fuertemente',
      'Confirmado o he visto evidencia directa',
    ],
    // Q2
    [
      'Nunca',
      'Una o dos veces, aislado',
      'Varias veces al mes',
      'Semanalmente o más',
    ],
    // Q3
    [
      'No — abierto y honesto',
      'A veces evasivo',
      'Frecuentemente secretista o evasivo',
      'Constantemente — no se abre en absoluto',
    ],
    // Q4
    [
      'Rara vez o nunca',
      'Ocasionalmente',
      'A menudo — la mayoría de los fines de semana',
      'La mayor parte de su tiempo libre',
    ],
    // Q5
    [
      'Calmados — los desacuerdos se resuelven fácilmente',
      'Tensión ocasional',
      'Discusiones frecuentes',
      'Gritos, portazos, casi a diario',
    ],
    // Q6
    [
      'Preparado — sé qué decir',
      'Algo preparado',
      'No sé cómo abordarlo',
      'Lo evito — me angustia la conversación',
    ],
    // Q7
    [
      'Siempre consistentes',
      'Casi siempre consistentes',
      'Inconsistentes',
      'Rara vez o nunca se aplican',
    ],
    // Q8
    [
      'Casi nunca',
      'Ocasionalmente',
      'A menudo — dudo la mayor parte del tiempo',
      'Constantemente — paralizado por la duda',
    ],
    // Q9
    [
      'Sin cambios notables',
      'Cambios leves',
      'Cambios claros y frecuentes',
      'Cambios dramáticos o casi a diario',
    ],
    // Q10
    [
      'No me preocupa',
      'Levemente preocupado',
      'Preocupación seria',
      'Miedo activo — pierdo el sueño',
    ],
    // Q11
    [
      'Totalmente alineados — mismo criterio en reglas y tono',
      'Mayormente alineados',
      'En desacuerdo a menudo',
      'Cada uno por su lado, o sin contacto con el co-padre',
    ],
    // Q12
    [
      'Rara vez o nunca',
      'Algunos compañeros me preocupan',
      'La mayoría de sus amigos son preocupantes',
      'Casi exclusivamente con compañeros en los que no confío',
    ],
    // Q13
    [
      'Muy cómodo — habla abiertamente',
      'A veces comparte',
      'Rara vez comparte',
      'Se cierra por completo — no se abre',
    ],
    // Q14
    [
      'Consistentemente — siempre sé',
      'La mayor parte del tiempo',
      'A menudo no estoy seguro',
      'Rara vez sé dónde está',
    ],
    // Q15
    [
      'Muy apoyado — en contacto activo con la escuela / entrenadores',
      'Algo de apoyo',
      'Apoyo limitado',
      'Me siento solo — sin contacto con la escuela ni la comunidad',
    ],
    // Q16
    [
      'Sí, trabajando con uno actualmente',
      'He buscado, explorando opciones',
      'Lo he considerado pero aún no',
      'No — no sabría por dónde empezar',
    ],
    // Q17
    [
      'Rara vez o nunca',
      'Ocasionalmente',
      'A menudo — la mayoría de las semanas',
      'Casi a diario — sin combustible',
    ],
    // Q18
    [
      'Muy claro — plan escrito alineado con el co-padre',
      'Una idea, no detallada',
      'No sé qué hacer',
      'Sin plan alguno',
    ],
    // Q19
    [
      'Asume sus errores consistentemente',
      'A veces',
      'Rara vez',
      'Nunca — culpa a otros o niega',
    ],
    // Q20
    [
      'Rutina sólida — sueño, escuela, comidas, actividades',
      'Algo de estructura, con vacíos',
      'Inconsistente',
      'Poca o ninguna estructura',
    ],
    // Q21
    [
      'Muy seguro — reglas claras, sin acceso, mensaje alineado',
      'Mayormente seguro',
      'No estoy seguro',
      'Preocupado — acceso, exposición o mensajes mixtos en casa',
    ],
    // Q22
    [
      'Totalmente preparado',
      'Algo preparado',
      'Inseguro de cómo equilibrar firmeza y apoyo',
      'No sé por dónde empezar',
    ],
    // Q23
    [
      'Rara vez',
      'Ocasionalmente',
      'A menudo',
      'Constantemente — me afecta el sueño, el trabajo o el ánimo',
    ],
    // Q24
    [
      'Listo ahora — comprometido a actuar',
      'Mayormente listo',
      'Vacilante',
      'Atascado — no sé qué hacer',
    ],
  ],
};

// Backend always returns the 5 concern domains by their English names
// (that's the API contract). These map each English key to a display
// label per UI language — translation is purely visual.
export const DOMAIN_LABELS: Record<Language, Record<string, string>> = {
  en: {
    'Immediate Safety & Urgency': 'Immediate Safety & Urgency',
    'Household Structure': 'Household Structure',
    'Boundary Consistency': 'Boundary Consistency',
    'Communication & Conflict': 'Communication & Conflict',
    'Support & Professional Engagement': 'Support & Professional Engagement',
  },
  es: {
    'Immediate Safety & Urgency': 'Seguridad inmediata y urgencia',
    'Household Structure': 'Estructura del hogar',
    'Boundary Consistency': 'Consistencia de límites',
    'Communication & Conflict': 'Comunicación y conflicto',
    'Support & Professional Engagement': 'Apoyo y acompañamiento profesional',
  },
};

export function domainLabel(lang: Language, englishName: string): string {
  return DOMAIN_LABELS[lang][englishName] ?? englishName;
}

export const SECTION_LABELS_BY_LANG: Record<
  Language,
  Array<[string, string]>
> = {
  en: [
    ['urgentConcern', 'Urgent Concern Acknowledged'],
    ['headlineSummary', 'Headline Summary'],
    ['topImmediatePriorities', 'Top 3 Immediate Priorities'],
    ['keyPriorities', 'Key Priorities'],
    ['whatToAvoid', 'What to Avoid'],
    ['first72Hours', 'First 72 Hours Plan'],
    ['days4to7', 'Days 4–7 Continuation'],
    ['encouragement', 'Encouragement & Direction'],
  ],
  es: [
    ['urgentConcern', 'Preocupación urgente reconocida'],
    ['headlineSummary', 'Resumen inicial'],
    ['topImmediatePriorities', '3 Prioridades inmediatas'],
    ['keyPriorities', 'Prioridades clave'],
    ['whatToAvoid', 'Qué evitar'],
    ['first72Hours', 'Plan de las primeras 72 horas'],
    ['days4to7', 'Días 4 a 7 — Continuación'],
    ['encouragement', 'Aliento y dirección'],
  ],
};

// Markers as emitted verbatim by the LLM in each language. The streaming
// parser looks for these substrings to segment the plan into sections.
export const SECTION_MARKERS_BY_LANG: Record<
  Language,
  Array<[string, string]>
> = {
  en: [
    ['urgentConcern', 'URGENT CONCERN ACKNOWLEDGED'],
    ['headlineSummary', 'HEADLINE SUMMARY'],
    ['topImmediatePriorities', 'TOP 3 IMMEDIATE PRIORITIES'],
    ['keyPriorities', 'KEY PRIORITIES'],
    ['whatToAvoid', 'WHAT TO AVOID'],
    ['first72Hours', 'FIRST 72 HOURS PLAN'],
    ['days4to7', 'DAYS 4 TO 7 CONTINUATION'],
    ['encouragement', 'ENCOURAGEMENT AND DIRECTION'],
  ],
  es: [
    ['urgentConcern', 'PREOCUPACIÓN URGENTE RECONOCIDA'],
    ['headlineSummary', 'RESUMEN INICIAL'],
    ['topImmediatePriorities', '3 PRIORIDADES INMEDIATAS'],
    ['keyPriorities', 'PRIORIDADES CLAVE'],
    ['whatToAvoid', 'QUÉ EVITAR'],
    ['first72Hours', 'PLAN DE LAS PRIMERAS 72 HORAS'],
    ['days4to7', 'DÍAS 4 A 7 — CONTINUACIÓN'],
    ['encouragement', 'ALIENTO Y DIRECCIÓN'],
  ],
};

export type UIStrings = {
  title: string;
  eyebrow: string;
  heroSub: string;
  benefits: [string, string, string];
  meta: string;
  reassure: string;
  ctaStart: string;
  questionnaireHeading: string;
  questionnaireSub: string;
  answeredOf: (n: number) => string;
  jumpToNext: string;
  generate: string;
  scoring: string;
  writing: string;
  submitHint: string;
  fillSample: string;
  errorHeading: string;
  retry: string;
  scoringTitle: string;
  scoringSub: string;
  writingTitle: string;
  writingSub: string;
  doneTitle: string;
  doneSub: string;
  domainScoresHeading: string;
  topPrioritiesHeading: string;
  actionPlanHeading: string;
  writingPlaceholder: string;
  languageLabel: string;
  crisisHeading: string;
  crisisIntro: string;
  crisisLabel: string;
  crisisPlaceholder: string;
  crisisHint: (remaining: number) => string;
  crisisSafetyNotice: string;
};

export const STRINGS: Record<Language, UIStrings> = {
  en: {
    title: 'A calm, clear plan when you need it most',
    eyebrow: 'Parent Action Plan',
    heroSub:
      'This tool helps parents quickly create a clear, step-by-step action plan to support their child dealing with substance use — in just a few minutes.',
    benefits: [
      'Understand what steps to take immediately',
      'Get a structured plan tailored to your situation',
      'Move forward with clarity and confidence',
    ],
    meta: '24 short questions · About 3 minutes · Confidential',
    reassure: 'You are in the right place. Start when you are ready.',
    ctaStart: 'Start the questionnaire',
    questionnaireHeading: 'A few questions about your situation',
    questionnaireSub:
      'Answer each on a 1–4 scale. 1 means things feel strong or healthy. 4 means things feel concerning. There are no right or wrong answers — your honest responses help shape the plan.',
    answeredOf: (n) => `Answered ${n} of 24`,
    jumpToNext: 'Jump to next unanswered',
    generate: 'Generate Action Plan',
    scoring: 'Scoring your answers…',
    writing: 'Writing your plan…',
    submitHint: 'Answer all 24 questions to generate your plan.',
    fillSample: 'Fill sample answers',
    errorHeading: 'Something went wrong.',
    retry: 'Try again',
    scoringTitle: 'Scoring your answers…',
    scoringSub: 'Mapping 24 responses to 5 concern domains.',
    writingTitle: 'Writing your plan…',
    writingSub:
      'Your plan is being written in real time below. This usually takes 20–40 seconds.',
    doneTitle: 'Your plan is ready.',
    doneSub:
      'Take your time reading through it — you can come back later to any section.',
    domainScoresHeading: 'Domain Scores',
    topPrioritiesHeading: 'Top Priorities',
    actionPlanHeading: 'Action Plan',
    writingPlaceholder: 'Writing…',
    languageLabel: 'Language',
    crisisHeading: 'Anything urgent we should know? (optional)',
    crisisIntro:
      'If something acute is happening — suspected fentanyl exposure, overdose, threats of self-harm, or violence at home — write a short note here. The plan will open with that concern and pin the right emergency resource. Skip this if it does not apply.',
    crisisLabel: 'Urgent concern',
    crisisPlaceholder:
      'e.g. Found a pill press in the bedroom last week. Worried about fentanyl.',
    crisisHint: (remaining) => `${remaining} characters left`,
    crisisSafetyNotice:
      'If your child is in immediate danger, call 911. For a suicide or mental-health crisis, call or text 988. For suspected overdose or poisoning, Poison Control: 1-800-222-1222.',
  },
  es: {
    title: 'Un plan claro y con los pies en la tierra, cuando más lo necesitas',
    eyebrow: 'Plan de Acción para Padres',
    heroSub:
      'Esta herramienta te ayuda a crear rápidamente un plan claro, paso a paso, para apoyar a tu hijo frente al consumo de sustancias — en apenas unos minutos.',
    benefits: [
      'Entiende qué pasos dar de inmediato',
      'Recibe un plan estructurado adaptado a tu situación',
      'Avanza con claridad y confianza',
    ],
    meta: '24 preguntas breves · Unos 3 minutos · Confidencial',
    reassure: 'Estás en el lugar correcto. Empieza cuando estés listo.',
    ctaStart: 'Comenzar el cuestionario',
    questionnaireHeading: 'Unas preguntas sobre tu situación',
    questionnaireSub:
      'Responde cada pregunta en una escala del 1 al 4. 1 significa que las cosas se sienten sólidas o sanas. 4 significa que te preocupan. No hay respuestas correctas o incorrectas — tus respuestas honestas son las que dan forma al plan.',
    answeredOf: (n) => `Respondidas ${n} de 24`,
    jumpToNext: 'Ir a la siguiente sin responder',
    generate: 'Generar plan de acción',
    scoring: 'Calculando tus respuestas…',
    writing: 'Escribiendo tu plan…',
    submitHint: 'Responde las 24 preguntas para generar tu plan.',
    fillSample: 'Llenar con respuestas de ejemplo',
    errorHeading: 'Algo salió mal.',
    retry: 'Reintentar',
    scoringTitle: 'Calculando tus respuestas…',
    scoringSub: 'Mapeando 24 respuestas a 5 dominios de preocupación.',
    writingTitle: 'Escribiendo tu plan…',
    writingSub:
      'Tu plan se está escribiendo en tiempo real abajo. Suele tardar entre 20 y 40 segundos.',
    doneTitle: 'Tu plan está listo.',
    doneSub:
      'Tómate tu tiempo para leerlo — puedes volver a cualquier sección más tarde.',
    domainScoresHeading: 'Puntajes por dominio',
    topPrioritiesHeading: 'Prioridades principales',
    actionPlanHeading: 'Plan de acción',
    writingPlaceholder: 'Escribiendo…',
    languageLabel: 'Idioma',
    crisisHeading: '¿Hay algo urgente que deberíamos saber? (opcional)',
    crisisIntro:
      'Si está pasando algo agudo — sospecha de fentanilo, sobredosis, amenazas de autolesión o violencia en casa — escribe una nota corta aquí. El plan abrirá con esa preocupación y fijará el recurso de emergencia correspondiente. Deja vacío si no aplica.',
    crisisLabel: 'Preocupación urgente',
    crisisPlaceholder:
      'p. ej. Encontré una prensa de pastillas en su cuarto la semana pasada. Me preocupa el fentanilo.',
    crisisHint: (remaining) => `Quedan ${remaining} caracteres`,
    crisisSafetyNotice:
      'Si tu hijo está en peligro inmediato, llama al 911. Para crisis suicida o de salud mental, llama o envía un mensaje al 988 (también atiende en español). Para sospecha de sobredosis o envenenamiento, Poison Control: 1-800-222-1222.',
  },
};
