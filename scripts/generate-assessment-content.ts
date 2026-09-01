/**
 * Emits `content/assessment.json` from the existing prompt sources.
 *
 * Generated rather than hand-transcribed on purpose: the questions, the option
 * labels and the domain map are approved methodology, and retyping 24 questions
 * × 4 options × 2 languages by hand is exactly the kind of task that introduces a
 * silent one-word difference nobody spots until a parent reads it.
 *
 * Run once to produce the content file, then treat `content/assessment.json` as
 * the source of truth and delete nothing here — re-running it after the prompt
 * sources are removed is how a reviewer verifies the transcription was faithful.
 *
 *   npx ts-node scripts/generate-assessment-content.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUESTIONS, ANSWER_LABELS } from '../src/report/prompts/questions';
import {
  QUESTIONS_ES,
  ANSWER_LABELS_ES,
} from '../src/report/prompts/questions.es';
import { DOMAIN_MAP, TIE_BREAK_ORDER } from '../src/report/scoring/domain.map';

/** Stable ids. `q01`-style, so they sort lexically and read unambiguously in a
 *  matrix rule. Index + 1 — Q1 is `q01`. */
const questionId = (index: number): string =>
  `q${String(index + 1).padStart(2, '0')}`;

/**
 * Approved amendments to the transcribed domain map.
 *
 * `DOMAIN_MAP` is the live old path's and stays untouched — that path still
 * serves parents until the switchover, and this milestone must not move it. The
 * V1 content diverges from it by exactly one approved decision: Dave approved
 * adding Q4 — exposure to environments where substances may be present — to
 * Immediate Safety & Urgency (via Matt, 2026-08-25, resolving
 * RECOMMENDATION-MATRIX.md §6.1). Q4 is index 3. It joins the domain average
 * only; the q01/q02/q10 child-safety subset in the matrix is unchanged.
 */
const APPROVED_DOMAIN_AMENDMENTS: Record<string, number[]> = {
  'Immediate Safety & Urgency': [3],
};

const AMENDED_DOMAIN_MAP: Record<string, number[]> = Object.fromEntries(
  Object.entries(DOMAIN_MAP).map(([label, indices]) => [
    label,
    [...indices, ...(APPROVED_DOMAIN_AMENDMENTS[label] ?? [])],
  ]),
);

/** Domain label → id slug, e.g. "Immediate Safety & Urgency" →
 *  "immediate-safety-urgency". The label stays the response key; the id is what
 *  rules reference. */
const domainId = (label: string): string =>
  label
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Spanish domain labels. The English labels are the API response keys and are
 * not translated; these are for display only.
 */
const DOMAIN_LABELS_ES: Record<string, string> = {
  'Immediate Safety & Urgency': 'Seguridad inmediata y urgencia',
  'Household Structure': 'Estructura del hogar',
  'Boundary Consistency': 'Consistencia de los límites',
  'Communication & Conflict': 'Comunicación y conflicto',
  'Support & Professional Engagement': 'Apoyo y participación profesional',
};

const DOMAIN_DESCRIPTIONS: Record<string, { en: string; es: string }> = {
  'Immediate Safety & Urgency': {
    en: 'How much direct evidence of use there is, how often it may be happening, and how exposed your child is to immediate physical risk.',
    es: 'Cuánta evidencia directa de consumo existe, con qué frecuencia puede estar ocurriendo, y qué tan expuesto está tu hijo a un riesgo físico inmediato.',
  },
  'Household Structure': {
    en: 'How much routine, supervision and predictability the home currently provides.',
    es: 'Cuánta rutina, supervisión y previsibilidad ofrece hoy el hogar.',
  },
  'Boundary Consistency': {
    en: 'Whether rules, rewards and consequences are applied the same way each time, and whether the adults are aligned on them.',
    es: 'Si las reglas, las recompensas y las consecuencias se aplican igual cada vez, y si los adultos están alineados en ellas.',
  },
  'Communication & Conflict': {
    en: 'How conversations about behaviour are going, and how much secrecy or conflict sits between you.',
    es: 'Cómo van las conversaciones sobre el comportamiento, y cuánto secretismo o conflicto hay entre ustedes.',
  },
  'Support & Professional Engagement': {
    en: 'How much help you have around you — school, community, professionals — and how supported you feel carrying this.',
    es: 'Cuánta ayuda tienes a tu alrededor — escuela, comunidad, profesionales — y qué tan apoyado te sientes al cargar con esto.',
  },
};

/**
 * Questions whose stem reads "more is better", so the option labels run from the
 * healthy end to the concerning end against the direction of the stem.
 *
 * `questions.ts` annotates eleven of these inline (Q6, Q11, Q13, Q14, Q15, Q18,
 * Q19, Q20, Q21, Q22, Q24). Q7 ("Always consistent" → "Rules rarely or never
 * enforced") and Q16 ("Yes, currently working with one" → "No") are inverted by
 * their own labels but carry no annotation, so they are included here and the
 * discrepancy is flagged in RECOMMENDATION-MATRIX.md.
 *
 * Documentation and display metadata only. The stored value already follows the
 * scale (higher = more concerning) for every question, so scoring must not
 * invert anything a second time.
 */
const INVERTED_STEMS = new Set([
  6, 7, 11, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24,
]);

/**
 * Approved Spanish label corrections from the native-speaker sign-off (Matt,
 * 2026-09-01). Applied here rather than in questions.es.ts for the same reason
 * as APPROVED_DOMAIN_AMENDMENTS: the old path still serves parents until the
 * switchover and must keep producing byte-identical prompts. Keyed by question
 * number, then option value.
 */
const APPROVED_LABEL_AMENDMENTS_ES: Record<number, Record<number, string>> = {
  // "Sin combustible" was an over-literal "running on empty".
  17: { 4: 'Casi a diario — completamente agotado' },
};

function build() {
  if (QUESTIONS.length !== QUESTIONS_ES.length) {
    throw new Error(
      `question count differs between languages: ${QUESTIONS.length} en, ${QUESTIONS_ES.length} es`,
    );
  }

  const questions = QUESTIONS.map((prompt, index) => {
    const labelsEn = ANSWER_LABELS[index];
    const labelsEs = ANSWER_LABELS_ES[index];
    if (!labelsEn || !labelsEs || labelsEn.length !== labelsEs.length) {
      throw new Error(
        `answer labels missing or mismatched for Q${index + 1}: ${labelsEn?.length} en, ${labelsEs?.length} es`,
      );
    }
    return {
      id: questionId(index),
      order: index + 1,
      responseType: 'scale' as const,
      prompt: { en: prompt, es: QUESTIONS_ES[index] },
      invertedStem: INVERTED_STEMS.has(index + 1),
      options: labelsEn.map((label, i) => ({
        value: i + 1,
        label: {
          en: label,
          es: APPROVED_LABEL_AMENDMENTS_ES[index + 1]?.[i + 1] ?? labelsEs[i],
        },
      })),
    };
  });

  const domains = Object.entries(AMENDED_DOMAIN_MAP).map(([label, indices], order) => ({
    id: domainId(label),
    order: order + 1,
    label: { en: label, es: DOMAIN_LABELS_ES[label] ?? label },
    description: DOMAIN_DESCRIPTIONS[label],
    // Sorted so the file reads in question order; the average is order-independent.
    questionIds: [...indices].sort((a, b) => a - b).map(questionId),
  }));

  const assigned = new Set(Object.values(AMENDED_DOMAIN_MAP).flat());
  const unassigned = questions
    .filter((_, index) => !assigned.has(index))
    .map((q) => q.id);
  if (unassigned.length > 0) {
    // Q4 was the one domainless question, and Dave's 2026-08-25 approval
    // assigned it. Every question now feeds a domain; a new orphan here is a
    // mistake, not a decision.
    throw new Error(
      `${unassigned.join(', ')} belong(s) to no domain — every question is expected to feed one since the Q4 amendment`,
    );
  }

  return {
    _comment: [
      'GENERATED by scripts/generate-assessment-content.ts from the approved',
      'question set, answer labels and domain map. Reviewed and then treated as',
      'the source of truth. Do not hand-edit the questions or option labels',
      'without re-running the generator, or the two will diverge.',
      '',
      'TWO PROPERTIES OF THE APPROVED SCORING LOOK LIKE MISTAKES AND ARE NOT:',
      '',
      '  1. Domains OVERLAP. q18 and q22 each count toward two domains, so the',
      '     domain question lists total 26 slots across 24 distinct questions.',
      '     This is why questionIds live on the domain rather than a domainId',
      '     living on the question. Carried over from the live system unchanged.',
      '',
      '  2. q04 counts toward Immediate Safety & Urgency HERE and not in the',
      '     old path. It belonged to no domain in the live system; Dave approved',
      '     adding it (via Matt, 2026-08-25, resolving RECOMMENDATION-MATRIX.md',
      '     §6.1). The amendment is applied by the generator so the old path’s',
      '     DOMAIN_MAP stays exactly what it serves today. q04 joins the domain',
      '     average only — the q01/q02/q10 child-safety subset is unchanged.',
    ],
    version: '1.0.0',
    status: 'approved',
    methodologyVersion: 'MI-V1.0',
    title: {
      en: 'Monitoring & Intervention — Family Risk Assessment & Action Plan',
      es: 'Monitoreo e Intervención — Evaluación de Riesgo Familiar y Plan de Acción',
    },
    intro: {
      en: 'Twenty-four questions about what you are seeing at home. There are no right answers, and nothing here is a diagnosis — the more honest the answers, the more useful the plan.',
      es: 'Veinticuatro preguntas sobre lo que estás viendo en casa. No hay respuestas correctas, y nada de esto es un diagnóstico — cuanto más honestas sean las respuestas, más útil será el plan.',
    },
    scale: { min: 1, max: 4, direction: 'higher-is-more-concerning' },
    domains,
    tieBreakOrder: TIE_BREAK_ORDER.map(domainId),
    questions,
    urgentField: {
      id: 'urgentConcern',
      maxLength: 2000,
      label: {
        en: 'Is there anything urgent you want to tell us?',
        es: '¿Hay algo urgente que quieras contarnos?',
      },
      help: {
        en: 'Optional. If something has just happened — you found something, or your child may have taken something — tell us here and the plan will address it first.',
        es: 'Opcional. Si algo acaba de pasar — encontraste algo, o tu hijo pudo haber consumido algo — cuéntanoslo aquí y el plan lo abordará primero.',
      },
      placeholder: {
        en: 'What happened, and when?',
        es: '¿Qué pasó, y cuándo?',
      },
    },
    // No gate questions. The proposed 25th — treatment-status, which decided
    // whether the Sustaining Recovery transition section appeared — was
    // declined by ASAP on 2026-08-25: the assessment stays at 24 questions and
    // the transition to the Sustaining Recovery Essential Workshop is handled
    // inside the Circle program journey instead (RECOMMENDATION-MATRIX.md §7).
    // The gate MECHANISM survives it — schema, validator, evaluator and the
    // frontend all still render whatever appears here — so a future gate is a
    // content edit, not a code change.
    gates: [],
  };
}

const target = join(__dirname, '..', 'content', 'assessment.json');
writeFileSync(target, `${JSON.stringify(build(), null, 2)}\n`, 'utf8');
console.log(`wrote ${target}`);
