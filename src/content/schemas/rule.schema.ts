import { z } from 'zod';

/**
 * The condition AST shared by the recommendation matrix, the severity tiers, and
 * the routing rules. Conditions live in `content/*.json` as data and are
 * evaluated by `src/selection/rule.evaluator.ts` — so revising the approved
 * methodology is a content edit, never a code change.
 *
 * Ported from the Sustaining Recovery FRAAP, plus three condition types this
 * methodology needs and that one does not:
 *   · `questionAverage`    — the mean of a named subset of questions
 *   · `questionValueCount` — how many of a subset sit at a given value
 *   · `gate`               — a non-scored gating answer (see `assessment.schema.ts`)
 *
 * The first two exist because the approved severity logic promotes a plan on the
 * child-safety questions specifically, not on a domain average. Without them the
 * tiers could not be expressed as data and would have stayed in code.
 *
 * Every schema here is `.strict()`. A typo like `"gtee": 3` must fail loudly at
 * boot rather than becoming a condition that silently never matches — a rule
 * that never fires is more dangerous than one that crashes, because nobody
 * notices a family quietly not receiving a recommendation.
 */

/** Numeric comparators. At least one must be present on a comparing condition. */
const comparatorShape = {
  gt: z.number().optional(),
  gte: z.number().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  eq: z.number().optional(),
  in: z.array(z.number()).min(1).optional(),
};

const COMPARATOR_KEYS = ['gt', 'gte', 'lt', 'lte', 'eq', 'in'] as const;

export type Comparator = {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  eq?: number;
  in?: number[];
};

const hasComparator = (value: Record<string, unknown>): boolean =>
  COMPARATOR_KEYS.some((key) => value[key] !== undefined);

const requireComparator = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine((value) => hasComparator(value as Record<string, unknown>), {
    message: `at least one comparator is required (${COMPARATOR_KEYS.join(', ')})`,
  });

const comparatorObject = requireComparator(
  z.object(comparatorShape).strict(),
) as z.ZodType<Comparator>;

/** `{ "domainScore": "immediate-safety-urgency", "gte": 3.0 }` */
const domainScoreCondition = requireComparator(
  z.object({ domainScore: z.string().min(1), ...comparatorShape }).strict(),
);

/** `{ "question": "q11", "gte": 3 }` — keyed by question id, never by position. */
const questionCondition = requireComparator(
  z.object({ question: z.string().min(1), ...comparatorShape }).strict(),
);

/**
 * `{ "questionAverage": ["q01", "q02", "q10"], "gte": 3 }`
 *
 * The mean of a named subset of questions. Required by the approved severity
 * logic, which promotes a plan on the average of the three child-safety
 * questions — certainty of use, suspected frequency, and safety concern —
 * independently of any domain average. Q23 and Q24 belong to the same domain but
 * are deliberately excluded from this subset: they measure the parent's internal
 * state, not evidence about the child.
 */
const questionAverageCondition = requireComparator(
  z
    .object({
      questionAverage: z.array(z.string().min(1)).min(1),
      ...comparatorShape,
    })
    .strict(),
);

/**
 * `{ "questionValueCount": { "questions": ["q01","q02","q10"], "value": 4 }, "gte": 1 }`
 *
 * How many of a named subset sit at a given scale value. Required by the
 * approved severity logic: three or more 4s promote to SERIOUS only if at least
 * one of them is a child-safety question, so that a household under strain with
 * no use or safety signal stays in MODERATE.
 */
const questionValueCountCondition = requireComparator(
  z
    .object({
      questionValueCount: z
        .object({
          questions: z.array(z.string().min(1)).min(1),
          value: z.number().int(),
        })
        .strict(),
      ...comparatorShape,
    })
    .strict(),
);

/** `{ "answeredCount": { "value": 4, "gte": 3 } }` — how many answers equal `value`. */
const answeredCountCondition = z
  .object({
    answeredCount: requireComparator(
      z.object({ value: z.number().int(), ...comparatorShape }).strict(),
    ),
  })
  .strict();

/** `{ "overallAverage": { "gte": 2.75 } }` — mean across all domain averages. */
const overallAverageCondition = z
  .object({ overallAverage: comparatorObject })
  .strict();

/** `{ "urgentTextPresent": true }` — the parent wrote in the optional urgent
 *  concern field. This is what promotes a plan to the CRITICAL shape. */
const urgentTextPresentCondition = z
  .object({ urgentTextPresent: z.boolean() })
  .strict();

/**
 * `{ "gate": "treatment-status", "in": ["post-treatment-stable"] }`
 *
 * Reads a **non-scored** gating answer. This exists for one reason: the approved
 * 24-question assessment measures suspected or active use and the parent's
 * capacity to respond, and contains no signal for whether a child has reached
 * abstinence or sustained stability. Low scores mean "early-stage, possibly
 * nothing yet" — the opposite of recovery — so the transition to Sustaining
 * Recovery cannot be inferred from them without routing early-stage families
 * into a post-treatment workshop.
 *
 * A gate answer is therefore collected separately, is not scored, is not part of
 * any domain, and cannot affect severity. It only decides whether a conditional
 * section appears. See `RECOMMENDATION-MATRIX.md` §7.
 */
const gateCondition = z
  .object({
    gate: z.string().min(1),
    in: z.array(z.string().min(1)).min(1),
  })
  .strict();

/**
 * `{ "tier": ["serious", "critical"] }`
 *
 * The severity tier the submission resolved to. The approved routing table needs
 * this: two rows fire on "confirmed use **or** SERIOUS severity", and inlining
 * the whole SERIOUS definition into each of them would duplicate the tier rule
 * and let the two drift apart.
 *
 * Valid on recommendations and sections only — a tier's own condition cannot read
 * the tier, and boot validation rejects it there rather than letting it silently
 * evaluate false.
 */
const tierCondition = z
  .object({ tier: z.array(z.string().min(1)).min(1) })
  .strict();

/** `{ "always": true }` for a catch-all, `{ "always": false }` to disable a rule. */
const alwaysCondition = z.object({ always: z.boolean() }).strict();

/**
 * Hand-written rather than derived with `z.infer`.
 *
 * `conditionSchema` is recursive via `z.lazy`, and inference through a lazy
 * schema collapses to `any` — which would silently remove all type safety from
 * the evaluator and let a variant go missing from the union without a single
 * compile error. Declaring the shapes here and asserting the schema against them
 * with `z.ZodType<Condition>` keeps Zod as the runtime check and TypeScript as
 * the compile-time one, with neither pretending to derive the other.
 */
export interface DomainScoreCondition extends Comparator {
  domainScore: string;
}

export interface QuestionCondition extends Comparator {
  question: string;
}

export interface AnsweredCountCondition {
  answeredCount: Comparator & { value: number };
}

export interface QuestionAverageCondition extends Comparator {
  questionAverage: string[];
}

export interface QuestionValueCountCondition extends Comparator {
  questionValueCount: { questions: string[]; value: number };
}

export interface OverallAverageCondition {
  overallAverage: Comparator;
}

export interface UrgentTextPresentCondition {
  urgentTextPresent: boolean;
}

export interface GateCondition {
  gate: string;
  in: string[];
}

export interface TierCondition {
  tier: string[];
}

export interface AlwaysCondition {
  always: boolean;
}

export interface AllCondition {
  all: Condition[];
}

export interface AnyCondition {
  any: Condition[];
}

export interface NotCondition {
  not: Condition;
}

export type Condition =
  | DomainScoreCondition
  | QuestionCondition
  | AnsweredCountCondition
  | QuestionAverageCondition
  | QuestionValueCountCondition
  | OverallAverageCondition
  | UrgentTextPresentCondition
  | GateCondition
  | TierCondition
  | AlwaysCondition
  | AllCondition
  | AnyCondition
  | NotCondition;

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionSchema).min(1) }).strict(),
    z.object({ any: z.array(conditionSchema).min(1) }).strict(),
    z.object({ not: conditionSchema }).strict(),
    answeredCountCondition,
    questionAverageCondition,
    questionValueCountCondition,
    overallAverageCondition,
    urgentTextPresentCondition,
    gateCondition,
    tierCondition,
    alwaysCondition,
    domainScoreCondition,
    questionCondition,
  ]),
);

/** Bilingual copy. Both languages are required — a missing translation ships a
 *  blank section to a Spanish-speaking parent, so it fails at boot instead. */
export const localizedStringSchema = z
  .object({
    en: z.string().min(1),
    es: z.string().min(1),
  })
  .strict();

export type LocalizedString = z.infer<typeof localizedStringSchema>;
