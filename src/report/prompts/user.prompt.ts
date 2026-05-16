import { QUESTIONS } from './questions';
import { QUESTIONS_ES } from './questions.es';
import { formatResourceDirectory } from './resources';
import type { Language } from '../dto/generate-report.dto';

export const SECTION_HEADERS_EN = [
  'HEADLINE SUMMARY',
  'TOP 3 IMMEDIATE PRIORITIES',
  'KEY PRIORITIES',
  'WHAT TO AVOID',
  'FIRST 72 HOURS PLAN',
  'DAYS 4 TO 7 CONTINUATION',
  'ENCOURAGEMENT AND DIRECTION',
] as const;

export const SECTION_HEADERS_ES = [
  'RESUMEN INICIAL',
  '3 PRIORIDADES INMEDIATAS',
  'PRIORIDADES CLAVE',
  'QUÉ EVITAR',
  'PLAN DE LAS PRIMERAS 72 HORAS',
  'DÍAS 4 A 7 — CONTINUACIÓN',
  'ALIENTO Y DIRECCIÓN',
] as const;

export function getSectionHeaders(language: Language): readonly string[] {
  return language === 'es' ? SECTION_HEADERS_ES : SECTION_HEADERS_EN;
}

export function buildUserPrompt(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
  language: Language = 'en',
): string {
  return language === 'es'
    ? buildUserPromptEs(domainScores, topDomains, responses)
    : buildUserPromptEn(domainScores, topDomains, responses);
}

function buildUserPromptEn(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
): string {
  const scoreLines = [
    `- Immediate Safety & Urgency: ${domainScores['Immediate Safety & Urgency'].toFixed(2)}`,
    `- Household Structure: ${domainScores['Household Structure'].toFixed(2)}`,
    `- Boundary Consistency: ${domainScores['Boundary Consistency'].toFixed(2)}`,
    `- Communication & Conflict: ${domainScores['Communication & Conflict'].toFixed(2)}`,
    `- Support & Professional Engagement: ${domainScores['Support & Professional Engagement'].toFixed(2)}`,
  ].join('\n');

  let contextBlock = '';

  if (responses && responses.length === 24) {
    const concerns = responses
      .map((val, i) => (val === 4 ? `- ${QUESTIONS[i]}` : null))
      .filter(Boolean);
    const strengths = responses
      .map((val, i) => (val === 1 ? `- ${QUESTIONS[i]}` : null))
      .filter(Boolean);

    if (concerns.length > 0) {
      contextBlock += `\n\nStrong concerns (scored 4 — address these directly):\n${concerns.join('\n')}`;
    }
    if (strengths.length > 0) {
      contextBlock += `\n\nStrengths (scored 1 — acknowledge briefly):\n${strengths.join('\n')}`;
    }
  }

  const severity = classifySeverityEn(responses, domainScores);
  const severityBlock = `\n\nSEVERITY LEVEL: ${severity.level}\n${severity.guidance}`;

  return `Domain Scores:
${scoreLines}

Top 3 Priority Domains: ${topDomains[0]}, ${topDomains[1]}, ${topDomains[2]}${contextBlock}${severityBlock}

${formatResourceDirectory()}

Reminders before you write:
- This plan is a continuation of the parent's ASAP Community work — not a standalone report.
- Every resource recommendation must come from the ASAP RESOURCE DIRECTORY above, cited by full exact title. Do not invent, rename, shorten, paraphrase, renumber, or abbreviate titles. Articles of Action are referenced by title only — never by chapter number.
- ASAP Discussion Groups are a PRIMARY support mechanism. Tell the parent to JOIN THE or REACH OUT TO a specific group this week (action language, never passive). Always reference groups in canonical form "<Title> discussion group" — e.g., "Monitoring and Intervention discussion group", "Sustaining Recovery discussion group", "Parent Support Forum discussion group". Reinforce in this report that ASAP discussion groups are an invaluable source of support, insight, and shared experience for parents.
- The "Monitoring and Intervention discussion group" is the parent's primary peer-support recommendation in EVERY tier (MILD, MODERATE, SERIOUS) — it is the canonical group for TOP 3 IMMEDIATE PRIORITIES #3, regardless of severity.
- PROFESSIONAL HELP SEQUENCE (hard rule, every tier): every time you mention "therapist," "treatment provider," "treatment center," "professional help," "ASAP-endorsed," "clinician," "bring in a professional," "find a therapist," or "treatment program," the same paragraph must contain this two-sentence sequence verbatim, in order: 'For guidance, consider posting questions in the Sustaining Recovery discussion group.' then 'In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.' Both sentences. No exceptions. The prior lead-in 'For deeper insights, reach out to the "Sustaining Recovery discussion group."' is now BANNED — do not use it. Other banned lead-ins: "If you have questions," "If you want to share experiences," "If you have questions or want parent perspectives." The Sustaining Recovery discussion group is specifically the forum for perspectives regarding professional help.
- NO PLACEHOLDERS (hard rule, applies to the professional-help sequence and to the entire output): never write a placeholder, label, bracketed token, or meta-reference to the two-sentence sequence in place of the sentences themselves. Banned exact strings and any close variant: "Add the two-sentence sequence here", "Add the two-sentence sequence here:", "Insert the professional help sequence", "[two-sentence sequence above]", "[sequence]", "[SR + Admin Spaces sentence]", "see the sequence above", "as referenced above", "the SR + Admin Spaces sentence", "the professional-help sequence above". Each time professional help is mentioned, the two sentences must appear in full, verbatim, in order — even if the same report or paragraph already used the sequence earlier. Re-write it in full every single time. The sequence is a literal output string, never a referenced label.
- WORKSHOP CATEGORIES (hard rule, every citation): cite Essential Workshops as 'Essential Workshop "X"' (5 total: "Creating Your Personalized Prevention Plan", "Effective Communication: Building Trust and Engagement with Your Teen", "Monitoring and Intervention: Knowing When and How to Step In", "Building a Support Network", "Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment") and Auxiliary Workshops as 'Auxiliary Workshop "X"' (20 total — see directory). "Building a Support Network" is ESSENTIAL, never Auxiliary — citing it as Auxiliary is a labeling error.
- The "Sustaining Recovery discussion group" does NOT appear in reports that do not recommend professional help. In MILD reports (no therapist recommendation in TOP 3 PRIORITIES or KEY PRIORITIES), the M&I citation in TOP 3 #3 stands alone — no SR or Admin Spaces sentence.
- The "Building a Support Network discussion group" is RESTRICTED — it appears only in the same paragraph as the Essential Workshop "Building a Support Network." Do not cite it in BUILD THE SUPPORT GROUP or elsewhere.
- BUILD THE SUPPORT GROUP (TOP 3 #3) is EXCLUSIVELY about the parent's own peer support — joining and actively posting in the "Monitoring and Intervention discussion group." It is NEVER about the child. Do not write any of the following in that bullet: "surround the child with trusted adults," "support the child with trusted adults," "identify a trusted adult to confide in," "reach out to a trusted adult for support" — these are banned in any form.
- TRUSTED ADULT (banned generic, hard rule): never recommend that the parent "identify a trusted adult," "reach out to a trusted adult," "surround the child with trusted adults," or any close variant. This phrasing is not part of the ASAP methodology. Building a broader network around the child (family, school staff, coaches, therapists, community) is the EXCLUSIVE territory of the Essential Workshop "Building a Support Network" — cite that workshop by exact title, and call out engaging schools as one of its most important components. Co-parent surrogate alignment (TOP 3 #2 and DAY 1) uses "co-parent" or "another parent / guardian on the family side" — never "trusted adult."
- PROBLEM → RESOURCE ROUTING (hard mappings): peer pressure → cite Auxiliary Workshop "Understanding and Navigating Peer Pressure" + Article of Action "Peer Pressure and Social Contagion: Guiding Your Child Through Influence" (NOT a discussion group as substitute). Confirmed/suspected use → cite Auxiliary Workshop "Intervening When Substance Use is Present: First Steps and Next Steps". Secrecy / hidden use → "How and When to Search a Room" + "Searching Your Child’s Room – Knowing What’s in Your House". Mood swings / withdrawal / mental-health signals → "Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills" + "Mental Health and Drug Use – The Link Between Mental Health and Substance Abuse". Inconsistent consequences → "Behavioral Contracts – A Tool for Positive Change" + "Setting Boundaries with Respect: Discipline Without Punishment". Discussion groups are peer support — they do not substitute for the workshop or article when one is named for the input pattern.
- ROUTING COMPLETENESS (hard rule): for every routing pattern that fires in the Strong concerns list above, BOTH the named Auxiliary Workshop AND the named Article of Action must appear by exact title somewhere in the plan body (KEY PRIORITIES, FIRST 72 HOURS PLAN, or DAYS 4 TO 7). If three patterns fire, all three pairings must appear — do not silently drop one. Citing one when the row names two is a violation. The WHAT TO AVOID bullets that name a specific input pattern should pair the warning with a positive resource cited by exact title (what to do instead). Do a final-pass check before outputting: if a pairing is missing, rewrite the relevant priority area.
- SEVERITY GATING (hard rule): in SERIOUS reports, do NOT cite "Early Warning Signs – Identifying Substance Use Before It Becomes a Problem" and do NOT use awareness-stage framing ("something may be developing," "early signs to watch for," "this is a good time to pay closer attention"). Use "Intervening When Substance Use is Present: First Steps and Next Steps" instead. In MILD reports, do NOT cite intervention-stage workshops ("Intervening When Substance Use is Present", "Drug Testing"), and do NOT recommend treatment centers, drug tests, behavioral contracts, or ASAP-endorsed therapists in FIRST 72 HOURS PLAN or KEY PRIORITIES.
- INTERVENTION DEPTH for SERIOUS (hard rule): assume the teen will deny, deflect, shut down, or escalate. Banned soft fallbacks as *next steps*: "revisit later," "come back to it later," "wait and see," "see how it goes," "step back from the conversation entirely," "circle back when things calm down." DAY 3 must spell out firm responses to denial/shutdown/escalation — the boundary already aligned with the co-parent stands. DAYS 4 TO 7 must include at least one firm structured next step (a drug test, a behavioral contract, or an ASAP-endorsed therapist referral — the therapist reference auto-triggers the PROFESSIONAL HELP SEQUENCE above). Each KEY PRIORITIES area in SERIOUS ends with: "if [behavior] happens this week, the next step is [specific action]."
- LANGUAGE: never write "avoid searching" — the correct phrasing is "Do not search your child's room, backpack, or phone in a confrontational way." Never write "confront" / "confronting your child" — replace with "talking with your child." Reinforce that the child is not the opponent — the substance use is.
- PRIVATE SEARCH (hard rule, every tier): whenever the plan recommends searching the child's room, backpack, or phone, write the canonical two-sentence line verbatim in the soft-search bullet (typically FIRST 72 HOURS PLAN Day 2): "Conduct any search of your child's room, backpack, or phone privately and without your child present. Leave the room as you found it and document anything relevant." "Privately" and "without your child present" must be written — they are not implied. Backpack belongs in the list alongside room and phone. The two-sentence line is a literal output string — write it in full every time, do not paraphrase.
- Name at least one Auxiliary Workshop by exact title whose topic matches the parent's strongest concerns.
- Tie every recommendation back to a specific behavior the parent reported above. Avoid advice that could apply to any parent.
- TOP 3 IMMEDIATE PRIORITIES must be (in this order): (1) parent's own emotional regulation, (2) co-parent / caregiver alignment, (3) build the support group. The conversation with the child is NOT one of the top 3 priorities.
- FIRST 72 HOURS PLAN sequencing is fixed: Day 1 = emotional regulation + co-parent alignment. Day 2 = build support group + gather information (soft search belongs here if secrecy or hidden use is indicated — done quietly, respectfully, with co-parent support, room left as found, evidence documented and removed as a clear boundary, not as punishment). Day 3 = prepare for the first real conversation — natural tone, not scripted lines.

Generate a Parent Action Plan. Use EXACTLY these seven section headers, each on its own line, in this exact order, written in plain UPPERCASE text with no markdown (no #, no *, no numbering, no bold):

${SECTION_HEADERS_EN.join('\n')}

Place the body of each section on the lines immediately following its header. Do not add any other headers, titles, or preamble before HEADLINE SUMMARY.`;
}

function buildUserPromptEs(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
): string {
  const scoreLines = [
    `- Immediate Safety & Urgency: ${domainScores['Immediate Safety & Urgency'].toFixed(2)}`,
    `- Household Structure: ${domainScores['Household Structure'].toFixed(2)}`,
    `- Boundary Consistency: ${domainScores['Boundary Consistency'].toFixed(2)}`,
    `- Communication & Conflict: ${domainScores['Communication & Conflict'].toFixed(2)}`,
    `- Support & Professional Engagement: ${domainScores['Support & Professional Engagement'].toFixed(2)}`,
  ].join('\n');

  let contextBlock = '';

  if (responses && responses.length === 24) {
    const concerns = responses
      .map((val, i) => (val === 4 ? `- ${QUESTIONS_ES[i]}` : null))
      .filter(Boolean);
    const strengths = responses
      .map((val, i) => (val === 1 ? `- ${QUESTIONS_ES[i]}` : null))
      .filter(Boolean);

    if (concerns.length > 0) {
      contextBlock += `\n\nPreocupaciones fuertes (respondidas con 4 — abórdalas de frente):\n${concerns.join('\n')}`;
    }
    if (strengths.length > 0) {
      contextBlock += `\n\nFortalezas (respondidas con 1 — reconócelas brevemente):\n${strengths.join('\n')}`;
    }
  }

  const severity = classifySeverityEs(responses, domainScores);
  const severityBlock = `\n\nSEVERITY LEVEL: ${severity.level}\n${severity.guidance}`;

  return `Puntajes por dominio (nombres en inglés — no los traduzcas en la salida):
${scoreLines}

Top 3 dominios de prioridad: ${topDomains[0]}, ${topDomains[1]}, ${topDomains[2]}${contextBlock}${severityBlock}

${formatResourceDirectory()}

Recordatorios antes de escribir:
- Este plan es una continuación del trabajo de la familia en la ASAP Community — no es un informe aislado.
- Cada recomendación de recurso debe venir del ASAP RESOURCE DIRECTORY de arriba, citada por título completo, EXACTO y EN INGLÉS. No inventes, renombres, acortes, parafrasees, enumeres ni abrevies títulos. Los Articles of Action se referencian por título — nunca por número de capítulo.
- Los ASAP Discussion Groups son un mecanismo PRIMARIO de apoyo. Dile al padre o madre que se UNA AL grupo o que se ACERQUE A él (lenguaje de acción, nunca pasivo). Refiérete siempre en forma canónica: "<Title> discussion group" — por ejemplo, "Monitoring and Intervention discussion group", "Sustaining Recovery discussion group", "Parent Support Forum discussion group". Refuerza en este reporte que los ASAP discussion groups son una fuente invaluable de apoyo, comprensión y experiencia compartida para los padres.
- El "Monitoring and Intervention discussion group" es la recomendación primaria del padre para apoyo entre pares en CADA nivel (LEVE, MODERADO, GRAVE) — es el grupo canónico para las 3 PRIORIDADES INMEDIATAS #3, sin distinción de severidad.
- PROFESSIONAL HELP SEQUENCE (regla dura, cada nivel): cada vez que menciones "terapeuta", "proveedor de tratamiento", "centro de tratamiento", "ayuda profesional", "ASAP-endorsed", "clínico", "traer a un profesional", "encuentra un terapeuta" o "programa de tratamiento", el mismo párrafo debe contener esta secuencia de dos oraciones textualmente y EN INGLÉS, en este orden: \'For guidance, consider posting questions in the Sustaining Recovery discussion group.\' luego \'In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.\' Ambas oraciones. Sin excepciones. La entrada anterior \'For deeper insights, reach out to the "Sustaining Recovery discussion group."\' queda PROHIBIDA — no la uses. Otras entradas prohibidas: "If you have questions", "If you want to share experiences", "Si tienes preguntas o quieres compartir experiencias". El "Sustaining Recovery discussion group" es específicamente el foro de perspectivas sobre la ayuda profesional.
- NO PLACEHOLDERS (regla dura, aplica a la professional-help sequence y a toda la salida): nunca escribas un marcador, etiqueta, token entre corchetes ni meta-referencia a la secuencia de dos oraciones en lugar de las oraciones mismas. Cadenas exactas prohibidas y cualquier variante cercana: "Add the two-sentence sequence here", "Add the two-sentence sequence here:", "Insert the professional help sequence", "[two-sentence sequence above]", "[sequence]", "[SR + Admin Spaces sentence]", "see the sequence above", "as referenced above", "the SR + Admin Spaces sentence", "the professional-help sequence above", "Inserta la secuencia aquí", "[secuencia de dos oraciones]". Cada vez que se mencione la ayuda profesional, las dos oraciones deben aparecer en su totalidad, textuales, en orden — incluso si el mismo reporte o párrafo ya usó la secuencia antes. Reescríbela en su totalidad cada vez. La secuencia es una salida literal, nunca una etiqueta de referencia.
- WORKSHOP CATEGORIES (regla dura, cada cita): cita Essential Workshops como 'Essential Workshop "X"' (5 en total: "Creating Your Personalized Prevention Plan", "Effective Communication: Building Trust and Engagement with Your Teen", "Monitoring and Intervention: Knowing When and How to Step In", "Building a Support Network", "Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment") y Auxiliary Workshops como 'Auxiliary Workshop "X"' (20 en total — ver el directorio). "Building a Support Network" es ESSENTIAL, nunca Auxiliary — citarlo como Auxiliary es un error de etiquetado.
- El "Sustaining Recovery discussion group" NO aparece en reportes que no recomiendan ayuda profesional. En reportes LEVES (sin recomendación de terapeuta en las 3 PRIORIDADES INMEDIATAS ni en PRIORIDADES CLAVE), la cita de M&I en las 3 PRIORIDADES INMEDIATAS #3 queda sola — sin SR ni oración de Admin Spaces.
- El "Building a Support Network discussion group" está RESTRINGIDO — aparece solo en el mismo párrafo que el Essential Workshop "Building a Support Network". No lo cites en CONSTRUIR EL GRUPO DE APOYO ni en otro lugar.
- CONSTRUIR EL GRUPO DE APOYO (3 PRIORIDADES INMEDIATAS #3) es EXCLUSIVAMENTE sobre el apoyo entre pares del propio padre — unirse y publicar activamente en el "Monitoring and Intervention discussion group". NUNCA se trata del hijo. No escribas en esa viñeta nada como: "rodea a tu hijo de adultos de confianza", "apoya a tu hijo con adultos de confianza", "identifica a un adulto de confianza para que tu hijo se confíe", "acércate a un adulto de confianza como apoyo para tu hijo" — estas formas (en español o en inglés "trusted adult") están prohibidas en cualquier variante.
- TRUSTED ADULT / ADULTO DE CONFIANZA (regla dura, recomendación genérica prohibida): nunca recomiendes que el padre "identifique a un adulto de confianza", "se acerque a un adulto de confianza", "rodee a su hijo de adultos de confianza", ni ninguna variante cercana — ni en español ni en inglés. Este encuadre no es parte de la metodología ASAP. Construir una red más amplia alrededor del hijo (familia, personal escolar, entrenadores, terapeutas, recursos comunitarios) es territorio EXCLUSIVO del Essential Workshop "Building a Support Network" — cita ese workshop por título exacto, y menciona que la participación de la escuela es uno de sus componentes más importantes. La alineación con el co-padre (3 PRIORIDADES INMEDIATAS #2 y DÍA 1) usa "co-padre" u "otro padre/madre o tutor en el lado familiar" — nunca "adulto de confianza".
- PROBLEM → RESOURCE ROUTING (mapeos duros): presión de pares → cita Auxiliary Workshop "Understanding and Navigating Peer Pressure" + Article of Action "Peer Pressure and Social Contagion: Guiding Your Child Through Influence" (NO un discussion group como sustituto). Consumo confirmado/sospechado → Auxiliary Workshop "Intervening When Substance Use is Present: First Steps and Next Steps". Secretismo / consumo oculto → "How and When to Search a Room" + "Searching Your Child’s Room – Knowing What’s in Your House". Cambios de ánimo / aislamiento / señales de salud mental → "Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills" + "Mental Health and Drug Use – The Link Between Mental Health and Substance Abuse". Consecuencias inconsistentes → "Behavioral Contracts – A Tool for Positive Change" + "Setting Boundaries with Respect: Discipline Without Punishment". Los discussion groups son apoyo entre pares — no sustituyen al workshop o article cuando la tabla nombra uno para el patrón.
- ROUTING COMPLETENESS (regla dura): por cada patrón de la tabla de enrutamiento que se active en la lista de Preocupaciones fuertes de arriba, AMBOS — el Auxiliary Workshop nombrado Y el Article of Action nombrado — deben aparecer por título exacto en el cuerpo del plan (PRIORIDADES CLAVE, PLAN DE LAS PRIMERAS 72 HORAS o DÍAS 4 A 7). Si se activan tres patrones, los tres emparejamientos deben aparecer — no descartes uno en silencio. Citar uno cuando la fila nombra dos es una violación. Las viñetas de QUÉ EVITAR que nombren un patrón específico deben emparejar la advertencia con un recurso positivo citado por título exacto (qué hacer en su lugar). Haz una revisión final antes de generar la salida: si falta un emparejamiento, reescribe el área de prioridad correspondiente.
- GATING DE SEVERIDAD (regla dura): en reportes GRAVES, NO cites "Early Warning Signs – Identifying Substance Use Before It Becomes a Problem" y NO uses encuadre de etapa de conciencia ("algo puede estar empezando", "señales tempranas para vigilar", "es buen momento para estar más atento"). Usa "Intervening When Substance Use is Present: First Steps and Next Steps" en su lugar. En reportes LEVES, NO cites talleres de intervención ("Intervening When Substance Use is Present", "Drug Testing"), y NO recomiendes centros de tratamiento, pruebas de drogas, behavioral contracts ni terapeutas ASAP-endorsed en el PLAN DE LAS PRIMERAS 72 HORAS ni en PRIORIDADES CLAVE.
- PROFUNDIDAD DE INTERVENCIÓN para casos GRAVES (regla dura): asume que el adolescente va a negar, esquivar, cerrarse o escalar. Fallbacks blandos prohibidos como *próximos pasos*: "lo retomamos después", "vuelve más adelante", "espera y observa", "a ver cómo va", "alejarse de la conversación por completo", "vuelve cuando las cosas se calmen". El DÍA 3 debe incluir respuestas firmes a la negación/cierre/escalada — el límite ya alineado con el co-padre se mantiene. DÍAS 4 A 7 debe incluir al menos un próximo paso firme y estructurado (una prueba de drogas, un behavioral contract, o una derivación a un terapeuta ASAP-endorsed — la referencia al terapeuta activa automáticamente la PROFESSIONAL HELP SEQUENCE de arriba). Cada área de PRIORIDADES CLAVE en GRAVE termina con: "si [comportamiento] sucede esta semana, el próximo paso es [acción específica]".
- LENGUAJE: nunca escribas "evita revisar" — la forma correcta es "No revises el cuarto, la mochila o el celular de tu hijo de manera confrontativa." Nunca uses "confrontar" / "confrontando" referido al hijo — reemplaza por "hablar con tu hijo". Refuerza que el hijo no es el oponente — el consumo lo es.
- PRIVATE SEARCH / REVISIÓN EN PRIVADO (regla dura, cada nivel): cuando el plan recomiende revisar el cuarto, la mochila o el celular del hijo, escribe la línea canónica de dos oraciones textual en la viñeta de soft search (típicamente PLAN DE LAS PRIMERAS 72 HORAS DÍA 2): "Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente. Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante." "En privado" y "sin que tu hijo esté presente" deben quedar escritas — no se sobreentienden. La mochila va en la lista junto al cuarto y el celular. La línea de dos oraciones es una salida literal — escríbela en su totalidad cada vez, no la parafrasees.
- Nombra al menos un Auxiliary Workshop por título exacto cuya temática coincida con las preocupaciones más fuertes.
- Conecta cada recomendación con un comportamiento específico que el padre o madre reportó arriba. Evita consejos que aplicarían a cualquier familia.
- Las 3 PRIORIDADES INMEDIATAS deben ir (en este orden): (1) regulación emocional del propio padre o madre, (2) alineación con el co-padre / cuidador, (3) construir el grupo de apoyo. La conversación con el hijo NO es una de las 3 prioridades principales.
- La secuencia del PLAN DE LAS PRIMERAS 72 HORAS es fija: Día 1 = regulación emocional + alineación con el co-padre. Día 2 = construir grupo de apoyo + reunir información (la soft search va aquí si hay secretismo o consumo oculto — en silencio, con respeto, con apoyo del co-padre, cuarto dejado como se encontró, evidencia documentada y retirada como límite claro, no como castigo). Día 3 = preparar la primera conversación real — tono natural, no líneas guionadas.
- Escribe el plan completo en español natural, directo, con "tú". Los títulos oficiales de recursos ASAP quedan EN INGLÉS textual.

Genera un Plan de Acción para Padres. Usa EXACTAMENTE estos siete encabezados de sección, cada uno en su propia línea, en este orden exacto, escritos en MAYÚSCULAS simples sin marcado (sin #, sin *, sin numeración antes, sin negrita):

${SECTION_HEADERS_ES.join('\n')}

Coloca el cuerpo de cada sección en las líneas inmediatamente después de su encabezado. No añadas otros encabezados, títulos ni preámbulo antes de RESUMEN INICIAL.`;
}

type Severity = {
  level: 'MILD' | 'MODERATE' | 'SERIOUS';
  guidance: string;
};

type SeverityEs = {
  level: 'LEVE' | 'MODERADO' | 'GRAVE';
  guidance: string;
};

function classifySeverityEn(
  responses: number[] | undefined,
  domainScores: Record<string, number>,
): Severity {
  const tier = computeSeverityTier(responses, domainScores);

  if (tier === 'SERIOUS') {
    return {
      level: 'SERIOUS',
      guidance:
        'Inputs show multiple strong concerns or elevated safety signals. Grounded urgency — calm, direction-giving, never alarmist. Name the emotional weight directly only where the inputs actually show it. ASAP-endorsed professional referral may appear in the FIRST 72 HOURS PLAN. Reference external emergency resources only if acute-risk signals are explicit (suspected fentanyl/heroin, safety crisis, suicidality). HARD RULE 1 (universal parent support): The "Monitoring and Intervention discussion group" is the parent\'s canonical peer-support group in TOP 3 PRIORITIES #3 — every severity, no severity gating. Use action language: "join the" or "reach out to" — never passive. HARD RULE 2 (professional help sequence): every time you mention professional help — "therapist," "treatment provider," "treatment center," "professional help," "ASAP-endorsed," "clinician," "bring in a professional," "find a therapist," "treatment program" — the same paragraph must contain this two-sentence sequence verbatim, in order: \'For guidance, consider posting questions in the Sustaining Recovery discussion group.\' then \'In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.\' Both sentences. No exceptions. Banned lead-ins: "If you have questions," "If you want to share experiences," "If you have questions or want parent perspectives." NO PLACEHOLDERS — never write "Add the two-sentence sequence here", "Insert the professional help sequence", "[sequence above]", "the SR + Admin Spaces sentence", or any meta-reference in place of the two sentences. Re-write them in full every single time professional help is mentioned, even if the sequence was already used earlier in the report. HARD RULE 3 (SR is professional-help-gated): the "Sustaining Recovery discussion group" never appears in a paragraph that does not also reference professional help. The "Building a Support Network discussion group" is RESTRICTED — appears only with the Essential Workshop "Building a Support Network." HARD RULE 4 (severity gating): do NOT cite the Auxiliary Workshop "Early Warning Signs – Identifying Substance Use Before It Becomes a Problem" anywhere — the parent is past that stage. Use "Intervening When Substance Use is Present: First Steps and Next Steps" instead. Do NOT use awareness-stage framing ("something may be developing," "early signs to watch for," "this is a good time to pay closer attention"). HARD RULE 5 (intervention depth): assume the teen will deny, deflect, shut down, or escalate. Banned soft fallbacks as a *next step*: "revisit later," "come back to it later," "wait and see," "see how it goes," "give it some time," "step back from the conversation entirely," "circle back when things calm down." (Stepping away mid-flare to regulate is allowed; "revisit later" as a recommendation is not.) DAY 3 must spell out firm responses to denial / shutdown / escalation — the boundary already aligned with the co-parent stands. DAYS 4 TO 7 must include at least one firm structured next step: a drug test (cite the Auxiliary Workshop "Drug Testing" or Article of Action "Drug Testing: A Crucial Step in Intervention"), a behavioral contract (cite "Behavioral Contracts – A Tool for Positive Change" or "Behavior Contracts: A Tool for Accountability and Growth"), or escalation to an ASAP-endorsed therapist (auto-triggers HARD RULE 2). Each KEY PRIORITIES area ends with: "if [behavior] happens this week, the next step is [specific action]." HARD RULE 6 (resource routing): peer pressure → cite Auxiliary Workshop "Understanding and Navigating Peer Pressure" + Article of Action "Peer Pressure and Social Contagion: Guiding Your Child Through Influence" — NOT a discussion group as the substitute. Confirmed/suspected use → cite "Intervening When Substance Use is Present: First Steps and Next Steps". Secrecy → "How and When to Search a Room" + "Searching Your Child’s Room – Knowing What’s in Your House". Mood swings / withdrawal / mental-health signals → "Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills" + "Mental Health and Drug Use – The Link Between Mental Health and Substance Abuse". Inconsistent consequences → "Behavioral Contracts – A Tool for Positive Change" + "Setting Boundaries with Respect: Discipline Without Punishment". School disengagement → "Partnering with Schools for Your Child\'s Success" + "Building a Support Network" (this workshop emphasizes school engagement) + Article of Action "Partnering with Schools". HARD RULE 7 (PRIVATE SEARCH): whenever the plan recommends searching the child\'s room, backpack, or phone (typically the Day 2 soft-search bullet when secrecy or hidden use is indicated), the canonical two-sentence line MUST appear verbatim in that bullet: "Conduct any search of your child\'s room, backpack, or phone privately and without your child present. Leave the room as you found it and document anything relevant." Backpack belongs in the list alongside room and phone. "Privately" and "without your child present" are written, not implied.',
    };
  }
  if (tier === 'MILD') {
    return {
      level: 'MILD',
      guidance:
        'Inputs show early-stage signals at most — no strong concerns, safety low, most answers 1 or 2. Tone is observational and attentive, NOT urgent. Frame as "something may be developing — pay closer attention now." Do NOT use crisis/fear/overwhelm language. Do NOT recommend therapists or treatment centers in the FIRST 72 HOURS or KEY PRIORITIES — route energy toward ASAP Discussion Groups, foundational Articles of Action, and preventative Auxiliary Workshops. Professional referral, if mentioned at all, belongs in DAYS 4 TO 7 as a future "if the pattern changes" option, not a now-step. When that future-step is mentioned, it triggers the PROFESSIONAL HELP SEQUENCE (For guidance, consider posting questions in the Sustaining Recovery discussion group → Admin Spaces) per the universal hard rule. Soft search appears on Day 2 only if secrecy or hidden use is specifically indicated in the inputs; otherwise Day 2 is information-gathering + joining the "Monitoring and Intervention discussion group" (canonical for every severity). When the soft-search bullet does fire in MILD, the PRIVATE SEARCH hard rule still applies — write the canonical two-sentence line verbatim: "Conduct any search of your child\'s room, backpack, or phone privately and without your child present. Leave the room as you found it and document anything relevant." TOP 3 IMMEDIATE PRIORITIES #3 uses the "Monitoring and Intervention discussion group" in MILD too — and because MILD does NOT recommend professional help in that bullet, the M&I citation stands alone (no Sustaining Recovery, no Admin Spaces sentence in TOP 3 #3). Day 3 is a natural, low-pressure check-in, not a structured intervention.',
    };
  }
  return {
    level: 'MODERATE',
    guidance:
      'Inputs show real signals but not acute. Steady, direct, pragmatic tone — acknowledge concerns without amplifying them. ASAP Discussion Groups and Auxiliary Workshops are the primary resources. TOP 3 IMMEDIATE PRIORITIES #3 uses the "Monitoring and Intervention discussion group" (canonical, every severity). Professional referral is framed in DAYS 4 TO 7 with the full sequence inline: "If these patterns continue or intensify over the next week, an ASAP-endorsed therapist becomes the right next step. For guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program." — not as an immediate Day 1–3 action. "Start preparing to seek an ASAP-endorsed therapist" still triggers the full sequence; the sequence is not optional. INTERVENTION DEPTH (hard rule): anticipate pushback even in MODERATE. DAY 3 must name at least one concrete fallback for predictable resistance (denial, defensiveness, shutdown) — restate the boundary already aligned with the co-parent rather than re-arguing the point. DAYS 4 TO 7 must name at least one structured next step — a named Auxiliary Workshop by exact title, a named Article of Action by exact title, OR active posting in a specific Discussion Group with a defined check-in cadence. MODERATE does NOT require a drug test or behavioral contract (those are SERIOUS register), but it MUST name a concrete commitment — not "see how it goes" or "monitor and reassess." Each KEY PRIORITIES area ends with: "if [specific behavior] continues this week, the next step is [a named workshop / article / discussion group / scheduled check-in]." PRIVATE SEARCH (hard rule): when the Day 2 soft-search bullet fires (secrecy or hidden use indicated), write the canonical two-sentence line verbatim: "Conduct any search of your child\'s room, backpack, or phone privately and without your child present. Leave the room as you found it and document anything relevant." Backpack belongs in the list; "privately" and "without your child present" are written, not implied.',
  };
}

function classifySeverityEs(
  responses: number[] | undefined,
  domainScores: Record<string, number>,
): SeverityEs {
  const tier = computeSeverityTier(responses, domainScores);

  if (tier === 'SERIOUS') {
    return {
      level: 'GRAVE',
      guidance:
        'Los inputs muestran múltiples preocupaciones fuertes o señales de seguridad elevadas. Urgencia con los pies en la tierra — calmada, orientada a la acción, nunca alarmista. Nombra el peso emocional solo donde los inputs lo muestren. Una derivación profesional ASAP-endorsed puede aparecer en el PLAN DE LAS PRIMERAS 72 HORAS. Referencia recursos externos de emergencia solo si hay señales explícitas de riesgo agudo (sospecha de fentanilo/heroína, crisis de seguridad, ideación suicida). REGLA DURA 1 (apoyo universal del padre): el "Monitoring and Intervention discussion group" es el grupo canónico del padre para apoyo entre pares en las 3 PRIORIDADES INMEDIATAS #3 — toda severidad, sin distinción. Usa lenguaje de acción: "únete al" o "acércate al" — nunca pasivo. REGLA DURA 2 (professional help sequence): cada vez que menciones ayuda profesional — "terapeuta", "proveedor de tratamiento", "centro de tratamiento", "ayuda profesional", "ASAP-endorsed", "clínico", "traer a un profesional", "encuentra un terapeuta", "programa de tratamiento" — el mismo párrafo debe contener esta secuencia de dos oraciones textualmente y EN INGLÉS, en este orden: \'For guidance, consider posting questions in the Sustaining Recovery discussion group.\' luego \'In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program.\' Ambas oraciones. Sin excepciones. La entrada anterior \'For deeper insights, reach out to the "Sustaining Recovery discussion group."\' queda PROHIBIDA — no la uses. Otras entradas prohibidas: "If you have questions", "If you want to share experiences", "Si tienes preguntas o quieres compartir experiencias". NO PLACEHOLDERS — nunca escribas "Add the two-sentence sequence here", "Insert the professional help sequence", "[sequence above]", "the SR + Admin Spaces sentence", "Inserta la secuencia aquí" ni ninguna meta-referencia en lugar de las dos oraciones. Reescríbelas en su totalidad cada vez que se mencione la ayuda profesional, aun si la secuencia ya apareció antes en el reporte. REGLA DURA 3 (SR depende de ayuda profesional): el "Sustaining Recovery discussion group" nunca aparece en un párrafo que no referencie también la ayuda profesional. El "Building a Support Network discussion group" está RESTRINGIDO — aparece solo con el Essential Workshop "Building a Support Network". REGLA DURA 4 (gating de severidad): NO cites el Auxiliary Workshop "Early Warning Signs – Identifying Substance Use Before It Becomes a Problem" en ninguna parte — el padre ya pasó esa etapa. Usa "Intervening When Substance Use is Present: First Steps and Next Steps" en su lugar. NO uses encuadre de etapa de conciencia ("algo puede estar empezando", "señales tempranas para vigilar", "es buen momento para estar más atento"). REGLA DURA 5 (profundidad de intervención): asume que el adolescente va a negar, esquivar, cerrarse o escalar. Fallbacks blandos prohibidos como *próximo paso*: "lo retomamos después", "vuelve más adelante", "espera y observa", "a ver cómo va", "dale tiempo", "alejarse de la conversación por completo", "vuelve cuando las cosas se calmen". (Salir un momento para regularse está permitido; "lo retomamos después" como recomendación no.) DÍA 3 debe incluir respuestas firmes a la negación / cierre / escalada — el límite ya alineado con el co-padre se mantiene. DÍAS 4 A 7 debe incluir al menos un próximo paso firme y estructurado: una prueba de drogas (citando "Drug Testing" o "Drug Testing: A Crucial Step in Intervention"), un behavioral contract (citando "Behavioral Contracts – A Tool for Positive Change" o "Behavior Contracts: A Tool for Accountability and Growth"), o escalación a un terapeuta ASAP-endorsed (activa automáticamente la REGLA DURA 2). Cada área de PRIORIDADES CLAVE termina con: "si [comportamiento] sucede esta semana, el próximo paso es [acción específica]". REGLA DURA 6 (enrutamiento de recursos): presión de pares → cita Auxiliary Workshop "Understanding and Navigating Peer Pressure" + Article of Action "Peer Pressure and Social Contagion: Guiding Your Child Through Influence" — NO un discussion group como sustituto. Consumo confirmado/sospechado → "Intervening When Substance Use is Present: First Steps and Next Steps". Secretismo → "How and When to Search a Room" + "Searching Your Child’s Room – Knowing What’s in Your House". Cambios de ánimo / aislamiento / señales de salud mental → "Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills" + "Mental Health and Drug Use – The Link Between Mental Health and Substance Abuse". Consecuencias inconsistentes → "Behavioral Contracts – A Tool for Positive Change" + "Setting Boundaries with Respect: Discipline Without Punishment". Desconexión escolar → "Partnering with Schools for Your Child\'s Success" + "Building a Support Network" (este workshop enfatiza la participación de la escuela) + Article of Action "Partnering with Schools". REGLA DURA 7 (PRIVATE SEARCH / REVISIÓN EN PRIVADO): cuando el plan recomiende revisar el cuarto, la mochila o el celular del hijo (típicamente la viñeta de soft search del DÍA 2 cuando hay secretismo o consumo oculto indicado), la línea canónica de dos oraciones DEBE aparecer textual en esa viñeta: "Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente. Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante." La mochila va en la lista junto al cuarto y el celular. "En privado" y "sin que tu hijo esté presente" se escriben, no se sobreentienden.',
    };
  }
  if (tier === 'MILD') {
    return {
      level: 'LEVE',
      guidance:
        'Los inputs muestran como mucho señales tempranas — sin preocupaciones fuertes, seguridad baja, la mayoría de respuestas son 1 o 2. Tono observacional y atento, NO urgente. Enmárcalo como "algo puede estar empezando — presta más atención ahora". NO uses lenguaje de crisis / miedo / desborde. NO recomiendes terapeutas ni centros de tratamiento en el PLAN DE LAS PRIMERAS 72 HORAS ni en PRIORIDADES CLAVE — dirige la energía hacia ASAP Discussion Groups, Articles of Action fundacionales y Auxiliary Workshops preventivos. Una derivación profesional, si se menciona, va en DÍAS 4 A 7 como opción futura "si el patrón cambia", no como paso inmediato. Cuando se menciona ese paso futuro, activa la PROFESSIONAL HELP SEQUENCE (For guidance, consider posting questions in the Sustaining Recovery discussion group → Admin Spaces) según la regla universal. La soft search aparece en el Día 2 solo si hay secretismo o consumo oculto específicamente indicado; de lo contrario, el Día 2 es reunir información + unirse al "Monitoring and Intervention discussion group" (canónico para toda severidad). Cuando la viñeta de soft search sí se activa en LEVE, la regla dura PRIVATE SEARCH igual aplica — escribe la línea canónica de dos oraciones textual: "Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente. Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante." Las 3 PRIORIDADES INMEDIATAS #3 usan el "Monitoring and Intervention discussion group" también en LEVE — y como LEVE NO recomienda ayuda profesional en esa viñeta, la cita de M&I queda sola (sin Sustaining Recovery ni oración de Admin Spaces en las 3 PRIORIDADES INMEDIATAS #3). El Día 3 es un acercamiento natural y de baja presión, no una intervención estructurada.',
    };
  }
  return {
    level: 'MODERADO',
    guidance:
      'Los inputs muestran señales reales pero no agudas. Tono firme, directo, pragmático — reconoce las preocupaciones sin amplificarlas. Los ASAP Discussion Groups y los Auxiliary Workshops son los recursos primarios. Las 3 PRIORIDADES INMEDIATAS #3 usan el "Monitoring and Intervention discussion group" (canónico, toda severidad). La derivación profesional se ubica en DÍAS 4 A 7 con la secuencia completa en línea: "Si estos patrones continúan o se intensifican durante la próxima semana, un terapeuta ASAP-endorsed es el próximo paso. For guidance, consider posting questions in the Sustaining Recovery discussion group. In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program." — no como acción inmediata de los Días 1–3. "Empieza a prepararte para buscar un terapeuta ASAP-endorsed" igual activa la secuencia completa; la secuencia no es opcional. PROFUNDIDAD DE INTERVENCIÓN (regla dura): anticipa resistencia incluso en MODERADO. El DÍA 3 debe nombrar al menos un fallback concreto para la reacción predecible (negación, defensiva, cierre) — replantear el límite ya alineado con el co-padre, no volver a discutir el punto. DÍAS 4 A 7 debe nombrar al menos un próximo paso estructurado — un Auxiliary Workshop por título exacto, un Article of Action por título exacto, O participación activa en un Discussion Group específico con una cadencia de seguimiento definida. MODERADO NO requiere prueba de drogas ni behavioral contract (esos son registro GRAVE), pero SÍ debe nombrar un compromiso concreto — no "a ver cómo va" ni "observa y vuelve a evaluar". Cada área de PRIORIDADES CLAVE termina con: "si [comportamiento específico] continúa esta semana, el próximo paso es [un workshop / article / discussion group / seguimiento programado nombrado]". PRIVATE SEARCH (regla dura): cuando se active la viñeta de soft search del DÍA 2 (secretismo o consumo oculto indicado), escribe la línea canónica de dos oraciones textual: "Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente. Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante." La mochila va en la lista; "en privado" y "sin que tu hijo esté presente" se escriben, no se sobreentienden.',
  };
}

// Indices (0-based) of the five questions that map to the
// Immediate Safety & Urgency domain — Q1, Q2, Q10, Q23, Q24.
// Mirrors DOMAIN_MAP['Immediate Safety & Urgency'] in scoring/domain.map.ts.
const SAFETY_QUESTION_INDICES = [0, 1, 9, 22, 23] as const;

function computeSeverityTier(
  responses: number[] | undefined,
  domainScores: Record<string, number>,
): 'MILD' | 'MODERATE' | 'SERIOUS' {
  const safety = domainScores['Immediate Safety & Urgency'] ?? 0;
  const avg =
    Object.values(domainScores).reduce((a, b) => a + b, 0) /
    Math.max(Object.values(domainScores).length, 1);

  const fours = responses?.filter((r) => r === 4).length ?? 0;
  const threes = responses?.filter((r) => r === 3).length ?? 0;
  // SERIOUS via the fours-count pathway requires at least one of those fours
  // to be in the safety domain. This prevents promotion when 3+ fours land
  // entirely on conflict / household / co-parent questions with no actual
  // use or safety signal — a household-stress case that belongs in MODERATE.
  const safetyFours = (responses ?? []).filter(
    (v, i) =>
      v === 4 && (SAFETY_QUESTION_INDICES as readonly number[]).includes(i),
  ).length;

  if (safety >= 3 || avg >= 2.75 || (fours >= 3 && safetyFours >= 1))
    return 'SERIOUS';
  if (fours === 0 && threes <= 2 && avg <= 2.0 && safety < 2.0) return 'MILD';
  return 'MODERATE';
}
