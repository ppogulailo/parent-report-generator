// DRAFT CONTENT — Spanish Sustaining Recovery questionnaire (scaffold).
// Mirrors sr-questions.ts 1:1 by index. NOT founder-approved — replace with
// founder-reviewed wording before this plan ships. Scale: 1 = más sano, 4 = más
// preocupante.

export const SR_QUESTIONS_ES: string[] = [
  // Riesgo de recaída y seguridad (0–3)
  '¿Hace cuánto tiempo tu hijo terminó el tratamiento y volvió a casa?',
  '¿Qué tan preocupado estás por una recaída inmediata en las primeras semanas en casa?',
  '¿Has visto señales que asocias con el consumo pasado de tu hijo (cambios de ánimo, secretismo, viejos contactos)?',
  '¿Qué tan accesibles están las sustancias, el alcohol o los medicamentos sin asegurar en tu casa o alrededor?',
  // Entorno del hogar y disparadores (4–7)
  '¿Cuánto contacto mantiene tu hijo con los amigos o lugares ligados a su consumo pasado?',
  '¿Qué tan bien evita la rutina del hogar los disparadores específicos que tu hijo identificó en el tratamiento?',
  '¿Qué tan alineados están los cuidadores/co-padres sobre las reglas y el plan de recuperación ahora que tu hijo está en casa?',
  '¿Qué tan estable y con poco conflicto está el ambiente general del hogar en este momento?',
  // Rutina y estructura (8–11)
  '¿Cuánta estructura diaria (escuela/trabajo, sueño, comidas, actividades) tiene actualmente tu hijo?',
  '¿Con qué consistencia se siguen en casa las reglas, recompensas y consecuencias acordadas?',
  '¿Qué tan involucrado está tu hijo en actividades o intereses saludables que apoyen la recuperación?',
  '¿Qué tan claro es el plan de cuidado posterior (citas, reuniones, contactos) y qué tan de cerca se sigue?',
  // Comunicación y confianza (12–15)
  '¿Con qué apertura puede tu hijo hablar contigo sobre antojos, estrés o días difíciles?',
  '¿Cuánta confianza se ha reconstruido entre tú y tu hijo desde el tratamiento?',
  '¿Qué tan calmado y no reactivo logras mantenerte cuando surgen temas de la recuperación?',
  '¿Qué tan seguro te sientes de responder a un desliz o recaída sin escalar ni rendirte?',
  // Apoyo continuo y continuidad del tratamiento (16–19)
  '¿Qué tan conectado está tu hijo con apoyo profesional continuo (terapeuta, programa o grupo de recuperación)?',
  '¿Qué tan apoyado te sientes tú como padre — pares, familia, profesionales en quienes apoyarte?',
  '¿Qué tan preparado estás con un plan concreto si ocurre una recaída o crisis?',
  '¿Qué tan informado te sientes sobre las necesidades de recuperación de tu hijo y las sustancias involucradas?',
];

export const SR_ANSWER_LABELS_ES: string[][] = [
  [
    'En casa desde hace varios meses, ya asentado',
    'En casa desde hace unas semanas',
    'En casa solo días o una a dos semanas',
    'Volviendo a casa ahora / en los próximos días',
  ],
  [
    'No particularmente preocupado',
    'Levemente atento',
    'Preocupado',
    'Muy preocupado — creo que podría pasar pronto',
  ],
  [
    'Ninguna que pueda señalar',
    'Una o dos cosas pequeñas',
    'Varias señales conocidas',
    'Señales claras que reflejan el consumo pasado',
  ],
  [
    'Nada accesible; medicinas y alcohol asegurados',
    'Mayormente asegurado, algunos huecos',
    'Varias cosas aún accesibles',
    'Sustancias/alcohol/medicinas fácilmente al alcance',
  ],
  [
    'Sin contacto con el viejo grupo ni lugares',
    'Contacto ocasional y supervisado',
    'Contacto regular',
    'Contacto diario con la gente/lugares ligados al consumo',
  ],
  [
    'La rutina evita activamente los disparadores conocidos',
    'En su mayoría, con algo de exposición',
    'Los disparadores aparecen con frecuencia',
    'El día a día está lleno de los viejos disparadores',
  ],
  [
    'Totalmente alineados en el plan',
    'Mayormente alineados',
    'A menudo desincronizados',
    'Tirando en direcciones distintas',
  ],
  [
    'Calmado y estable',
    'Mayormente estable',
    'Frecuentemente tenso',
    'Mucho conflicto / caótico',
  ],
  [
    'Estructura diaria completa y predecible',
    'Algo de estructura',
    'Poca estructura',
    'Los días están sin estructura y a la deriva',
  ],
  [
    'Se siguen con consistencia',
    'Se siguen la mayoría de las veces',
    'A menudo inconsistentes',
    'Casi nunca se cumplen',
  ],
  [
    'Muy involucrado en actividades saludables',
    'Algo involucrado',
    'Apenas involucrado',
    'Sin actividades ni intereses saludables',
  ],
  [
    'Plan claro, seguido de cerca',
    'Plan claro, seguido sin rigor',
    'Plan vago, rara vez seguido',
    'Sin un verdadero plan de cuidado posterior',
  ],
  [
    'Habla abiertamente de los días difíciles',
    'A veces se abre',
    'Rara vez se abre',
    'Se cierra u oculta sus luchas',
  ],
  [
    'Confianza mayormente reconstruida',
    'Reconstruyéndose de forma constante',
    'Aún muy frágil',
    'Poca o ninguna confianza ahora mismo',
  ],
  [
    'Calmado y firme en esos momentos',
    'Por lo general firme',
    'A menudo reactivo',
    'Escalo o entro en pánico con facilidad',
  ],
  [
    'Seguro de poder responder con calma',
    'Bastante seguro',
    'Inseguro',
    'No tengo idea de cómo lo manejaría',
  ],
  [
    'Conectado y asistiendo activamente',
    'Conectado pero inconsistente',
    'Conectado de forma laxa',
    'Sin apoyo profesional continuo',
  ],
  ['Bien apoyado', 'Algo apoyado', 'Mayormente solo', 'Completamente solo'],
  [
    'Plan concreto listo',
    'Plan a grandes rasgos',
    'Solo ideas vagas',
    'Sin ningún plan',
  ],
  [
    'Bien informado sobre las necesidades de recuperación',
    'Bastante informado',
    'Algo a oscuras',
    'No sé qué debo vigilar',
  ],
];
