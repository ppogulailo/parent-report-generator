import { z } from 'zod';
import { localizedStringSchema } from './rule.schema';

/**
 * Schema for `content/assessment.json`.
 *
 * The 24 scored questions, their domains, and the two inputs that are **not**
 * scored: the optional urgent-concern free text, and the gating questions.
 */

export const assessmentDomainSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().positive(),
    /**
     * The human-readable domain name from the approved methodology. This is the
     * key used in the `domainScores` response, so it is copy the client owns and
     * changing it is a breaking API change.
     */
    label: localizedStringSchema,
    description: localizedStringSchema,
    /**
     * The questions averaged to produce this domain's score.
     *
     * Held on the domain, not as a `domainId` on each question, because the
     * approved methodology's domains **overlap**: Q18 and Q22 each count toward
     * two domains. A one-domain-per-question model cannot express that, and
     * forcing one would silently change every score.
     */
    questionIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const assessmentOptionSchema = z
  .object({
    value: z.number().int(),
    label: localizedStringSchema,
  })
  .strict();

export const assessmentQuestionSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().positive(),
    responseType: z.literal('scale'),
    prompt: localizedStringSchema,
    /**
     * True where a low answer is the concerning one and the option labels run in
     * the opposite direction — "How consistent are the consequences you set?"
     * reads 1 = very consistent. The stem is already written so that the stored
     * value follows the scale's own direction (higher = more concerning), so
     * this flag is documentation and display metadata, not arithmetic. Scoring
     * must never invert a second time.
     */
    invertedStem: z.boolean(),
    options: z.array(assessmentOptionSchema).min(2),
  })
  .strict();

export const urgentFieldSchema = z
  .object({
    id: z.string().min(1),
    maxLength: z.number().int().positive(),
    label: localizedStringSchema,
    help: localizedStringSchema,
    placeholder: localizedStringSchema,
  })
  .strict();

export const gateOptionSchema = z
  .object({
    /** Referenced by `{ "gate": ..., "in": [...] }` conditions. */
    value: z.string().min(1),
    label: localizedStringSchema,
  })
  .strict();

/**
 * A non-scored question.
 *
 * A gate is deliberately outside the scored set: it belongs to no domain, is
 * absent from `domainScores`, contributes nothing to any average, and cannot
 * move a family between severity tiers. Boot validation enforces all of that.
 *
 * It exists so a routing decision the 24 approved questions cannot express — is
 * this family post-treatment and stable? — can be made from something the parent
 * actually told us, rather than inferred from scores that were never designed to
 * measure it.
 */
export const gateQuestionSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().positive(),
    responseType: z.literal('choice'),
    prompt: localizedStringSchema,
    help: localizedStringSchema.optional(),
    /** A gate is always optional: an unanswered gate simply matches nothing. */
    options: z.array(gateOptionSchema).min(2),
    /** Why this gate exists, for whoever reads the content next. */
    rationale: z.string().min(1),
  })
  .strict();

export const assessmentSchema = z
  .object({
    version: z.string().min(1),
    status: z.enum(['draft', 'approved']),
    /**
     * The methodology this assessment implements. Recorded on every report so
     * "why did this family get this plan?" stays answerable after a revision.
     */
    methodologyVersion: z.string().min(1),
    title: localizedStringSchema,
    intro: localizedStringSchema,
    scale: z
      .object({
        min: z.number().int(),
        max: z.number().int(),
        direction: z.literal('higher-is-more-concerning'),
      })
      .strict()
      .refine((s) => s.max > s.min, {
        message: 'scale.max must be greater than scale.min',
      }),
    domains: z.array(assessmentDomainSchema).min(1),
    /** Domain priority for breaking ties when ranking top domains. */
    tieBreakOrder: z.array(z.string().min(1)).min(1),
    questions: z.array(assessmentQuestionSchema).min(1),
    urgentField: urgentFieldSchema,
    gates: z.array(gateQuestionSchema),
  })
  .strict();

export type Assessment = z.infer<typeof assessmentSchema>;
export type AssessmentQuestion = z.infer<typeof assessmentQuestionSchema>;
export type AssessmentDomain = z.infer<typeof assessmentDomainSchema>;
export type GateQuestion = z.infer<typeof gateQuestionSchema>;
