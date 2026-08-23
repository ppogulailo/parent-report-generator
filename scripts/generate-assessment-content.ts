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
        label: { en: label, es: labelsEs[i] },
      })),
    };
  });

  const domains = Object.entries(DOMAIN_MAP).map(([label, indices], order) => ({
    id: domainId(label),
    order: order + 1,
    label: { en: label, es: DOMAIN_LABELS_ES[label] ?? label },
    description: DOMAIN_DESCRIPTIONS[label],
    // Sorted so the file reads in question order; the average is order-independent.
    questionIds: [...indices].sort((a, b) => a - b).map(questionId),
  }));

  const assigned = new Set(Object.values(DOMAIN_MAP).flat());
  const unassigned = questions
    .filter((_, index) => !assigned.has(index))
    .map((q) => q.id);

  return {
    _comment: [
      'GENERATED by scripts/generate-assessment-content.ts from the approved',
      'question set, answer labels and domain map. Reviewed and then treated as',
      'the source of truth. Do not hand-edit the questions or option labels',
      'without re-running the generator, or the two will diverge.',
      '',
      'TWO PROPERTIES OF THE APPROVED SCORING ARE PRESERVED HERE DELIBERATELY,',
      'and both look like mistakes until you know they are not:',
      '',
      '  1. Domains OVERLAP. q18 and q22 each count toward two domains, so the',
      '     domain question lists total 25 slots across 23 distinct questions.',
      '     This is why questionIds live on the domain rather than a domainId',
      '     living on the question.',
      '',
      `  2. ${unassigned.join(', ') || 'no question'} belongs to NO domain. It is asked and stored, and a`,
      '     matrix rule can read it directly, but it contributes to no domain',
      '     average and therefore cannot move a family between severity tiers.',
      '',
      'Both are carried over from the live system unchanged. They are flagged in',
      'RECOMMENDATION-MATRIX.md for the founder to confirm or correct — a change',
      'to either one changes every score, so it is a methodology decision.',
    ],
    version: '1.0.0',
    status: 'draft',
    methodologyVersion: 'MI-V1.0-DRAFT',
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
    gates: [
      {
        id: 'treatment-status',
        order: 1,
        responseType: 'choice',
        prompt: {
          en: 'Where is your child with treatment or counselling right now?',
          es: '¿En qué punto está tu hijo con el tratamiento o la consejería en este momento?',
        },
        help: {
          // No leading "Optional." — the question already carries an Optional
          // tag, and saying it twice reads as a warning rather than a note.
          en: 'This does not affect your plan’s priorities. It only tells us whether to point you toward the Sustaining Recovery track.',
          es: 'Esto no afecta las prioridades de tu plan. Solo nos dice si conviene orientarte hacia el camino de Sustaining Recovery.',
        },
        options: [
          {
            value: 'none',
            label: {
              en: 'No treatment or counselling',
              es: 'Sin tratamiento ni consejería',
            },
          },
          {
            value: 'seeking',
            label: {
              en: 'Looking for help, not started yet',
              es: 'Buscando ayuda, aún sin empezar',
            },
          },
          {
            value: 'in-treatment',
            label: {
              en: 'Currently in therapy, counselling or treatment',
              es: 'Actualmente en terapia, consejería o tratamiento',
            },
          },
          {
            value: 'post-treatment-unstable',
            label: {
              en: 'Has been through treatment; use has continued or returned',
              es: 'Ya pasó por tratamiento; el consumo continuó o regresó',
            },
          },
          {
            value: 'post-treatment-stable',
            label: {
              en: 'Has been through treatment and has held a meaningful period without use',
              es: 'Ya pasó por tratamiento y ha mantenido un periodo significativo sin consumo',
            },
          },
        ],
        rationale:
          'The 24 approved questions measure suspected or active use and the parent’s capacity to respond. None of them asks whether a child has reached abstinence or sustained stability, and low scores mean "early-stage, possibly nothing yet" rather than "recovered" — so the transition to the Sustaining Recovery Essential Workshop cannot be inferred from scores without routing early-stage families into a post-treatment workshop. This gate is not scored, belongs to no domain, and cannot affect severity. It only decides whether the transition section appears.',
      },
    ],
  };
}

const target = join(__dirname, '..', 'content', 'assessment.json');
writeFileSync(target, `${JSON.stringify(build(), null, 2)}\n`, 'utf8');
console.log(`wrote ${target}`);
