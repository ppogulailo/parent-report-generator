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
- ASAP Discussion Groups are a PRIMARY support mechanism. Tell the parent to join AND actively post in a specific named group this week — not just "be aware" of them.
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
- Los ASAP Discussion Groups son un mecanismo PRIMARIO de apoyo. Dile al padre o madre que esta semana se una Y publique activamente en un grupo específico (por nombre exacto en inglés) — no solo "que sepa" que existen.
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
        'Inputs show multiple strong concerns or elevated safety signals. Grounded urgency — calm, direction-giving, never alarmist. Name the emotional weight directly only where the inputs actually show it. ASAP-endorsed professional referral may appear in the FIRST 72 HOURS PLAN. Reference external emergency resources only if acute-risk signals are explicit (suspected fentanyl/heroin, safety crisis, suicidality).',
    };
  }
  if (tier === 'MILD') {
    return {
      level: 'MILD',
      guidance:
        'Inputs show early-stage signals at most — no strong concerns, safety low, most answers 1 or 2. Tone is observational and attentive, NOT urgent. Frame as "something may be developing — this is a good time to pay closer attention." Do NOT use crisis/fear/overwhelm language. Do NOT recommend therapists or treatment centers in the FIRST 72 HOURS or KEY PRIORITIES — route energy toward ASAP Discussion Groups, foundational Articles of Action, and preventative Auxiliary Workshops. Professional referral, if mentioned at all, belongs in DAYS 4 TO 7 as a future "if the pattern changes" option, not a now-step. Soft search appears on Day 2 only if secrecy or hidden use is specifically indicated in the inputs; otherwise Day 2 is information-gathering + joining a discussion group. Day 3 is a natural, low-pressure check-in, not a structured intervention.',
    };
  }
  return {
    level: 'MODERATE',
    guidance:
      'Inputs show real signals but not acute. Steady, direct, pragmatic tone — acknowledge concerns without amplifying them. ASAP Discussion Groups and Auxiliary Workshops are the primary resources. Professional referral is framed in DAYS 4 TO 7 as "if these patterns continue or intensify, this is when an ASAP-endorsed therapist becomes the right next step" — not as an immediate Day 1–3 action.',
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
        'Los inputs muestran múltiples preocupaciones fuertes o señales de seguridad elevadas. Urgencia con los pies en la tierra — calmada, orientada a la acción, nunca alarmista. Nombra el peso emocional solo donde los inputs lo muestren. Una derivación profesional ASAP-endorsed puede aparecer en el PLAN DE LAS PRIMERAS 72 HORAS. Referencia recursos externos de emergencia solo si hay señales explícitas de riesgo agudo (sospecha de fentanilo/heroína, crisis de seguridad, ideación suicida).',
    };
  }
  if (tier === 'MILD') {
    return {
      level: 'LEVE',
      guidance:
        'Los inputs muestran como mucho señales tempranas — sin preocupaciones fuertes, seguridad baja, la mayoría de respuestas son 1 o 2. Tono observacional y atento, NO urgente. Enmárcalo como "algo puede estar empezando — buen momento para estar más atento". NO uses lenguaje de crisis / miedo / desborde. NO recomiendes terapeutas ni centros de tratamiento en el PLAN DE LAS PRIMERAS 72 HORAS ni en PRIORIDADES CLAVE — dirige la energía hacia ASAP Discussion Groups, Articles of Action fundacionales y Auxiliary Workshops preventivos. Una derivación profesional, si se menciona, va en DÍAS 4 A 7 como opción futura "si el patrón cambia", no como paso inmediato. La soft search aparece en el Día 2 solo si hay secretismo o consumo oculto específicamente indicado; de lo contrario, el Día 2 es reunir información + unirse a un discussion group. El Día 3 es un acercamiento natural y de baja presión, no una intervención estructurada.',
    };
  }
  return {
    level: 'MODERADO',
    guidance:
      'Los inputs muestran señales reales pero no agudas. Tono firme, directo, pragmático — reconoce las preocupaciones sin amplificarlas. Los ASAP Discussion Groups y los Auxiliary Workshops son los recursos primarios. La derivación profesional se ubica en DÍAS 4 A 7 como "si estos patrones continúan o se intensifican, ese es el momento de que un terapeuta ASAP-endorsed sea el próximo paso" — no como acción inmediata de los Días 1–3.',
  };
}

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

  if (fours >= 3 || safety >= 3 || avg >= 2.75) return 'SERIOUS';
  if (fours === 0 && threes <= 2 && avg <= 2.0 && safety < 2.0) return 'MILD';
  return 'MODERATE';
}
