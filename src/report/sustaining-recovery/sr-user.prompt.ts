// DRAFT CONTENT — Sustaining Recovery user-prompt builder + section parsing.
// Scaffold. Reuses the shared ASAP RESOURCE DIRECTORY (formatResourceDirectory)
// verbatim — the resource set is program-wide. NOT founder-approved.

import { formatResourceDirectory } from '../prompts/resources';
import { SR_ANSWER_LABELS, SR_QUESTIONS } from './sr-questions';
import { SR_ANSWER_LABELS_ES, SR_QUESTIONS_ES } from './sr-questions.es';
import type { Language } from '../dto/generate-report.dto';

// Section headers, English + Spanish, paired with the camelCase response key
// each maps to. URGENT CONCERN ACKNOWLEDGED is the conditional first section,
// emitted only when the parent supplies the optional crisis field.
export const SR_SECTIONS: ReadonlyArray<{
  key: keyof SustainingRecoveryReportSections;
  en: string;
  es: string;
}> = [
  {
    key: 'urgentConcern',
    en: 'URGENT CONCERN ACKNOWLEDGED',
    es: 'PREOCUPACIÓN URGENTE RECONOCIDA',
  },
  {
    key: 'welcomeHomeSummary',
    en: 'WELCOME HOME SUMMARY',
    es: 'RESUMEN DE BIENVENIDA A CASA',
  },
  {
    key: 'topImmediatePriorities',
    en: 'TOP 3 IMMEDIATE PRIORITIES',
    es: '3 PRIORIDADES INMEDIATAS',
  },
  {
    key: 'rebuildingStructure',
    en: 'REBUILDING DAILY STRUCTURE',
    es: 'RECONSTRUIR LA ESTRUCTURA DIARIA',
  },
  {
    key: 'relapseWarningSigns',
    en: 'RELAPSE WARNING SIGNS',
    es: 'SEÑALES DE ALERTA DE RECAÍDA',
  },
  { key: 'whatToAvoid', en: 'WHAT TO AVOID', es: 'QUÉ EVITAR' },
  {
    key: 'firstTwoWeeks',
    en: 'FIRST TWO WEEKS PLAN',
    es: 'PLAN DE LAS PRIMERAS DOS SEMANAS',
  },
  {
    key: 'ongoingSupport',
    en: 'ONGOING SUPPORT AND ENCOURAGEMENT',
    es: 'APOYO CONTINUO Y ALIENTO',
  },
] as const;

export interface SustainingRecoveryReportSections {
  urgentConcern: string;
  welcomeHomeSummary: string;
  topImmediatePriorities: string;
  rebuildingStructure: string;
  relapseWarningSigns: string;
  whatToAvoid: string;
  firstTwoWeeks: string;
  ongoingSupport: string;
}

const headerFor = (language: Language) =>
  SR_SECTIONS.map((s) => (language === 'es' ? s.es : s.en));

/**
 * Parse the model's UPPERCASE-header plan text into the SR section shape.
 * Mirrors the early-intervention parser (claude.service.ts#parseSections):
 * each section body runs from its header to the next all-caps header line.
 * Missing sections come back as the empty string.
 */
export function parseSustainingRecoverySections(
  text: string,
  language: Language,
): SustainingRecoveryReportSections {
  const extract = (label: string): string => {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `${esc}\\s*\\n([\\s\\S]*?)(?=\\n[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\\s&—-]+\\n|$)`,
      'i',
    );
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  };

  const out = {} as SustainingRecoveryReportSections;
  for (const section of SR_SECTIONS) {
    out[section.key] = extract(language === 'es' ? section.es : section.en);
  }
  return out;
}

export function buildSustainingRecoveryUserPrompt(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
  language: Language = 'en',
  crisis?: string,
): string {
  return language === 'es'
    ? buildEs(domainScores, topDomains, responses, crisis)
    : buildEn(domainScores, topDomains, responses, crisis);
}

function scoreLines(domainScores: Record<string, number>): string {
  return Object.entries(domainScores)
    .map(([domain, value]) => `- ${domain}: ${value.toFixed(2)}`)
    .join('\n');
}

function contextBlock(
  responses: number[] | undefined,
  questions: string[],
  labels: string[][],
  concernsHeader: string,
  strengthsHeader: string,
  answeredLabel: string,
): string {
  if (!responses || responses.length !== questions.length) return '';
  const concerns = responses
    .map((v, i) =>
      v === 4 ? `- ${questions[i]}\n  ${answeredLabel}: ${labels[i][3]}` : null,
    )
    .filter(Boolean);
  const strengths = responses
    .map((v, i) =>
      v === 1 ? `- ${questions[i]}\n  ${answeredLabel}: ${labels[i][0]}` : null,
    )
    .filter(Boolean);
  let out = '';
  if (concerns.length) out += `\n\n${concernsHeader}\n${concerns.join('\n')}`;
  if (strengths.length)
    out += `\n\n${strengthsHeader}\n${strengths.join('\n')}`;
  return out;
}

function buildEn(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
  crisis?: string,
): string {
  let ctx = contextBlock(
    responses,
    SR_QUESTIONS,
    SR_ANSWER_LABELS,
    'Strongest concerns (scored 4 — address these directly):',
    'Strengths (scored 1 — acknowledge and build on these):',
    "Parent's answer",
  );

  const trimmedCrisis = (crisis ?? '').trim();
  if (trimmedCrisis.length > 0) {
    ctx += `\n\nURGENT CONCERN — parent flagged this in the optional crisis field (address it FIRST in an URGENT CONCERN ACKNOWLEDGED section above WELCOME HOME SUMMARY, pinning the matching emergency resource, then continue the rest of the plan at HIGH RISK register):\n"${trimmedCrisis}"`;
  }

  const sev = classifySeverity(responses, domainScores, trimmedCrisis);
  const headers = trimmedCrisis.length
    ? headerFor('en')
    : headerFor('en').filter((h) => h !== 'URGENT CONCERN ACKNOWLEDGED');

  return `This is a SUSTAINING RECOVERY Parent Action Plan — the child has recently returned home from treatment. Domain Scores (post-treatment concern domains):
${scoreLines(domainScores)}

Top 3 Priority Domains: ${topDomains.join(', ')}${ctx}

RECOVERY STAGE: ${sev.level}
${sev.guidance}

${formatResourceDirectory()}

Reminders before you write:
- This is the post-treatment plan: the goal is sustaining recovery at home, not detecting first use. Recovery is not linear — frame setbacks as recoverable signals to respond to, never proof of failure.
- Balance oversight with rebuilding trust and autonomy. Name the over-policing-vs-under-structuring tension where the inputs show it.
- Every resource recommendation comes from the ASAP RESOURCE DIRECTORY above, cited by full exact title. NEVER cite an Article of Action by title. Workshop titles are directory-only — if none fits, omit.
- Anchor the plan in the Essential Workshop "Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment" and route relapse/setback content to the Auxiliary Workshop "Handling Setbacks – Staying Resilient in the Face of Challenges".
- PROFESSIONAL HELP SEQUENCE (hard rule, every time professional help / aftercare / a recovery group / a therapist is mentioned): the same paragraph must contain, verbatim and in order: "For guidance, consider posting questions in the Sustaining Recovery discussion group." then "In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program." Both sentences, every time, no placeholders.
- BUILD YOUR PERSONAL SUPPORT GROUP (TOP 3 #3) is the parent's own peer support: "Join and actively post in the 'Monitoring and Intervention discussion group.'" Never about the child.
- REWARDS paired with CONSEQUENCES every time. UNKNOWN SUBSTANCE, never "pills". PRIVATE SEARCH canonical line verbatim wherever a check is recommended. Tie every recommendation to a specific reported behavior.

Generate the plan. Use EXACTLY these ${headers.length} section headers, each on its own line, in this exact order, in plain UPPERCASE with no markdown:

${headers.join('\n')}

Place the body of each section on the lines immediately following its header. ${
    trimmedCrisis.length
      ? 'The URGENT CONCERN ACKNOWLEDGED section comes FIRST — name the specific urgent concern and pin the matching emergency resource (988 Suicide & Crisis Lifeline for suicidality, 911 + local domestic-violence hotline for active violence, Poison Control 1-800-222-1222 + naloxone/Narcan for suspected overdose or relapse with an unknown substance, 911 for any immediate danger) in 2–3 calm, direction-giving sentences. Then continue with WELCOME HOME SUMMARY.'
      : 'Do not add any other headers or preamble before WELCOME HOME SUMMARY. Do NOT emit an URGENT CONCERN ACKNOWLEDGED section — it only appears when the parent supplies the optional crisis field.'
  }`;
}

function buildEs(
  domainScores: Record<string, number>,
  topDomains: string[],
  responses?: number[],
  crisis?: string,
): string {
  let ctx = contextBlock(
    responses,
    SR_QUESTIONS_ES,
    SR_ANSWER_LABELS_ES,
    'Preocupaciones más fuertes (respondidas con 4 — abórdalas de frente):',
    'Fortalezas (respondidas con 1 — reconócelas y construye sobre ellas):',
    'Respuesta del padre',
  );

  const trimmedCrisis = (crisis ?? '').trim();
  if (trimmedCrisis.length > 0) {
    ctx += `\n\nPREOCUPACIÓN URGENTE — el padre marcó esto en el campo opcional de crisis (abórdalo PRIMERO en una sección PREOCUPACIÓN URGENTE RECONOCIDA arriba de RESUMEN DE BIENVENIDA A CASA, fijando el recurso de emergencia correspondiente, luego continúa el resto del plan en registro de ALTO RIESGO):\n"${trimmedCrisis}"`;
  }

  const sev = classifySeverity(responses, domainScores, trimmedCrisis);
  const headers = trimmedCrisis.length
    ? headerFor('es')
    : headerFor('es').filter((h) => h !== 'PREOCUPACIÓN URGENTE RECONOCIDA');

  return `Este es un Plan de Acción para Padres de SUSTAINING RECOVERY — el hijo volvió recientemente a casa del tratamiento. Puntajes por dominio (nombres en inglés — no los traduzcas en la salida):
${scoreLines(domainScores)}

Top 3 dominios de prioridad: ${topDomains.join(', ')}${ctx}

RECOVERY STAGE: ${sev.level}
${sev.guidance}

${formatResourceDirectory()}

Recordatorios antes de escribir:
- Este es el plan post-tratamiento: el objetivo es sostener la recuperación en casa, no detectar un primer consumo. La recuperación no es lineal — enmarca los retrocesos como señales recuperables a las que responder, nunca como prueba de fracaso.
- Equilibra la supervisión con reconstruir la confianza y la autonomía. Nombra la tensión vigilar-de-más vs estructurar-de-menos donde los inputs lo muestren.
- Cada recurso viene del ASAP RESOURCE DIRECTORY de arriba, citado por título completo, EXACTO y EN INGLÉS. NUNCA cites un Article of Action por título. Los títulos de workshops son solo del directorio — si ninguno encaja, omite.
- Ancla el plan en el Essential Workshop "Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment" y enruta el contenido de recaída/retroceso al Auxiliary Workshop "Handling Setbacks – Staying Resilient in the Face of Challenges".
- PROFESSIONAL HELP SEQUENCE (regla dura, cada vez que menciones ayuda profesional / cuidado posterior / grupo de recuperación / terapeuta): el mismo párrafo debe contener, textual y en orden, EN INGLÉS: "For guidance, consider posting questions in the Sustaining Recovery discussion group." luego "In Admin Spaces, under Treatment Providers, you can find a listing of treatment providers & therapists who endorse and support the ASAP program." Ambas oraciones, cada vez, sin placeholders.
- CONSTRUIR TU GRUPO PERSONAL DE APOYO (3 PRIORIDADES #3) es el apoyo entre pares del propio padre: "Únete y publica activamente en el 'Monitoring and Intervention discussion group.'" Nunca sobre el hijo.
- RECOMPENSAS junto a CONSECUENCIAS cada vez. SUSTANCIA DESCONOCIDA, nunca "pastillas". REVISIÓN EN PRIVADO con la línea canónica textual donde se recomiende una revisión. Conecta cada recomendación con un comportamiento específico reportado.

Genera el plan. Usa EXACTAMENTE estos ${headers.length} encabezados de sección, cada uno en su propia línea, en este orden exacto, en MAYÚSCULAS simples sin marcado:

${headers.join('\n')}

Coloca el cuerpo de cada sección en las líneas inmediatamente después de su encabezado. ${
    trimmedCrisis.length
      ? 'La sección PREOCUPACIÓN URGENTE RECONOCIDA va PRIMERO — nombra la preocupación urgente específica y fija el recurso de emergencia correspondiente (988 Suicide & Crisis Lifeline para ideación suicida, 911 + línea local de violencia doméstica para violencia activa, Poison Control 1-800-222-1222 + naloxona/Narcan para sospecha de sobredosis o recaída con una sustancia desconocida, 911 para cualquier peligro inmediato) en 2–3 oraciones calmadas. Luego continúa con RESUMEN DE BIENVENIDA A CASA.'
      : 'No añadas otros encabezados ni preámbulo antes de RESUMEN DE BIENVENIDA A CASA. NO emitas una sección PREOCUPACIÓN URGENTE RECONOCIDA — solo aparece cuando el padre llena el campo opcional de crisis.'
  }`;
}

// ── Recovery-stage classification (DRAFT) ────────────────────────────────────
// Post-treatment severity is driven primarily by relapse-risk signals, not the
// overall average. A child fresh home with active warning signs is HIGH RISK
// even if other domains look settled.

type Stage = { level: 'STABLE' | 'WATCHFUL' | 'HIGH RISK'; guidance: string };

function classifySeverity(
  responses: number[] | undefined,
  domainScores: Record<string, number>,
  crisis?: string,
): Stage {
  if ((crisis ?? '').trim().length > 0) return STAGE_HIGH;

  const relapse = domainScores['Relapse Risk & Safety'] ?? 2;
  const avg =
    Object.values(domainScores).reduce((a, b) => a + b, 0) /
    Math.max(Object.values(domainScores).length, 1);
  const fours = responses?.filter((r) => r === 4).length ?? 0;

  if (relapse >= 3 || avg >= 2.75 || fours >= 4) return STAGE_HIGH;
  if (relapse <= 1.75 && avg <= 2.0 && fours === 0) return STAGE_STABLE;
  return STAGE_WATCHFUL;
}

const STAGE_HIGH: Stage = {
  level: 'HIGH RISK',
  guidance:
    'Strong relapse-risk signals or an explicit crisis. Grounded urgency — calm, decisive, never alarmist. Secure the environment now (alcohol, unsecured medication, anything usable), confirm aftercare is active, and treat verification tools as firm next steps: a drug test (cite the Auxiliary Workshop "Drug Testing") or a behavioral contract (cite "Behavioral Contracts – A Tool for Positive Change"). Professional-help / aftercare is recommended directly and triggers the PROFESSIONAL HELP SEQUENCE in full. RELAPSE WARNING SIGNS must name concrete signals tied to this child and the agreed response to each. Reference external emergency resources only if acute-risk signals are explicit (suspected overdose, unknown substance ingestion, suicidality, violence).',
};

const STAGE_WATCHFUL: Stage = {
  level: 'WATCHFUL',
  guidance:
    'Recovery is holding but real risk remains. Steady, pragmatic tone. Reinforce routine, accountability check-ins, and continuity of aftercare (which triggers the PROFESSIONAL HELP SEQUENCE wherever professional help is named). RELAPSE WARNING SIGNS names the specific signals to watch and a pre-agreed response. Route stress/craving content to the Auxiliary Workshop "Managing Stress and Pressure – Helping Your Teen Develop Healthy Coping Skills" and setback content to "Handling Setbacks – Staying Resilient in the Face of Challenges".',
};

const STAGE_STABLE: Stage = {
  level: 'STABLE',
  guidance:
    'Recovery looks stable for now. Tone is encouraging and maintenance-oriented, NOT alarmist. Reinforce the routine and trust already being rebuilt, keep aftercare continuity, and remind the parent that recovery is long-term — what looks stable today can shift, so steady oversight and continued participation in the ASAP Community and the "Monitoring and Intervention discussion group" matter over time. Verification tools (drug test, behavioral contract) are framed as available-if-needed, not immediate steps.',
};
