export const QUESTIONS_ES: string[] = [
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
];

// Anclas de comportamiento por pregunta. Índice 0 = etiqueta para puntaje 1
// (fortaleza), índice 3 = etiqueta para puntaje 4 (preocupación). El 1 siempre
// representa el extremo más saludable y el 4 el extremo más preocupante —
// sin importar si el enunciado de la pregunta es naturalmente "más = peor"
// (frecuencia, intensidad) o "más = mejor" (confianza, alineación, disposición).
// Las etiquetas cargan la dirección para que el padre no tenga que traducirla.
export const ANSWER_LABELS_ES: string[][] = [
  // Q1 — certeza de consumo
  [
    'Seguro que no',
    'No estoy seguro, pero creo que no',
    'Lo sospecho fuertemente',
    'Confirmado o he visto evidencia directa',
  ],
  // Q2 — frecuencia sospechada
  [
    'Nunca',
    'Una o dos veces, aislado',
    'Varias veces al mes',
    'Semanalmente o más',
  ],
  // Q3 — secretismo / mentiras / evasión
  [
    'No — abierto y honesto',
    'A veces evasivo',
    'Frecuentemente secretista o evasivo',
    'Constantemente — no se abre en absoluto',
  ],
  // Q4 — exposición a entornos
  [
    'Rara vez o nunca',
    'Ocasionalmente',
    'A menudo — la mayoría de los fines de semana',
    'La mayor parte de su tiempo libre',
  ],
  // Q5 — intensidad del conflicto
  [
    'Calmados — los desacuerdos se resuelven fácilmente',
    'Tensión ocasional',
    'Discusiones frecuentes',
    'Gritos, portazos, casi a diario',
  ],
  // Q6 — preparación para confrontar (enunciado invertido)
  [
    'Preparado — sé qué decir',
    'Algo preparado',
    'No sé cómo abordarlo',
    'Lo evito — me angustia la conversación',
  ],
  // Q7 — consistencia de consecuencias
  [
    'Siempre consistentes',
    'Casi siempre consistentes',
    'Inconsistentes',
    'Rara vez o nunca se aplican',
  ],
  // Q8 — duda sobre reaccionar de más / de menos
  [
    'Casi nunca',
    'Ocasionalmente',
    'A menudo — dudo la mayor parte del tiempo',
    'Constantemente — paralizado por la duda',
  ],
  // Q9 — cambios de ánimo / aislamiento / agresividad
  [
    'Sin cambios notables',
    'Cambios leves',
    'Cambios claros y frecuentes',
    'Cambios dramáticos o casi a diario',
  ],
  // Q10 — preocupación por seguridad
  [
    'No me preocupa',
    'Levemente preocupado',
    'Preocupación seria',
    'Miedo activo — pierdo el sueño',
  ],
  // Q11 — alineación cuidador / co-padre (enunciado invertido)
  [
    'Totalmente alineados — mismo criterio en reglas y tono',
    'Mayormente alineados',
    'En desacuerdo a menudo',
    'Cada uno por su lado, o sin contacto con el co-padre',
  ],
  // Q12 — compañeros de mala influencia
  [
    'Rara vez o nunca',
    'Algunos compañeros me preocupan',
    'La mayoría de sus amigos son preocupantes',
    'Casi exclusivamente con compañeros en los que no confío',
  ],
  // Q13 — el hijo comparte su dolor emocional (enunciado invertido)
  [
    'Muy cómodo — habla abiertamente',
    'A veces comparte',
    'Rara vez comparte',
    'Se cierra por completo — no se abre',
  ],
  // Q14 — monitoreo de paradero (enunciado invertido)
  [
    'Consistentemente — siempre sé',
    'La mayor parte del tiempo',
    'A menudo no estoy seguro',
    'Rara vez sé dónde está',
  ],
  // Q15 — apoyo de escuela / comunidad (enunciado invertido)
  [
    'Muy apoyado — en contacto activo con la escuela / entrenadores',
    'Algo de apoyo',
    'Apoyo limitado',
    'Me siento solo — sin contacto con la escuela ni la comunidad',
  ],
  // Q16 — ha buscado orientación profesional
  [
    'Sí, trabajando con uno actualmente',
    'He buscado, explorando opciones',
    'Lo he considerado pero aún no',
    'No — no sabría por dónde empezar',
  ],
  // Q17 — agotamiento / miedo / desborde
  [
    'Rara vez o nunca',
    'Ocasionalmente',
    'A menudo — la mayoría de las semanas',
    'Casi a diario — sin combustible',
  ],
  // Q18 — claridad del plan de próximos pasos (enunciado invertido)
  [
    'Muy claro — plan escrito alineado con el co-padre',
    'Una idea, no detallada',
    'No sé qué hacer',
    'Sin plan alguno',
  ],
  // Q19 — el hijo asume responsabilidad (enunciado invertido)
  [
    'Asume sus errores consistentemente',
    'A veces',
    'Rara vez',
    'Nunca — culpa a otros o niega',
  ],
  // Q20 — estructura en la rutina diaria (enunciado invertido)
  [
    'Rutina sólida — sueño, escuela, comidas, actividades',
    'Algo de estructura, con vacíos',
    'Inconsistente',
    'Poca o ninguna estructura',
  ],
  // Q21 — el ambiente en casa desalienta el consumo (enunciado invertido)
  [
    'Muy seguro — reglas claras, sin acceso, mensaje alineado',
    'Mayormente seguro',
    'No estoy seguro',
    'Preocupado — acceso, exposición o mensajes mixtos en casa',
  ],
  // Q22 — preparación para límites firmes con apoyo (enunciado invertido)
  [
    'Totalmente preparado',
    'Algo preparado',
    'Inseguro de cómo equilibrar firmeza y apoyo',
    'No sé por dónde empezar',
  ],
  // Q23 — preocupación por consecuencias a largo plazo
  [
    'Rara vez',
    'Ocasionalmente',
    'A menudo',
    'Constantemente — me afecta el sueño, el trabajo o el ánimo',
  ],
  // Q24 — disposición a actuar con decisión (enunciado invertido)
  [
    'Listo ahora — comprometido a actuar',
    'Mayormente listo',
    'Vacilante',
    'Atascado — no sé qué hacer',
  ],
];
