import { z } from 'zod';

/** Schema for `content/voice.json` — the wording the methodology forbids. */

const termListSchema = z
  .object({
    en: z.array(z.string().min(1)).min(1),
    es: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const voiceRuleSchema = z
  .object({
    id: z.string().min(1),
    /**
     * `words` match on word boundaries; `phrases` match anywhere.
     *
     * The distinction is load-bearing. Banning the *word* "reinforce" must not
     * fire on "reinforcement", and banning the *phrase* "wait and see" must fire
     * wherever it appears. A stem you want caught in every form belongs in
     * `phrases`.
     */
    kind: z.enum(['words', 'phrases']),
    /** Why the methodology forbids it. Fed back to the model on a violation, so
     *  it is an explanation rather than a scolding. */
    reason: z.string().min(1),
    strictness: z.enum(['retry', 'warn']),
    /** Tiers the rule applies at. Omitted means all tiers. */
    appliesAtTiers: z.array(z.string().min(1)).min(1).optional(),
    terms: termListSchema,
  })
  .strict();

export const voiceSchema = z
  .object({
    version: z.string().min(1),
    rules: z.array(voiceRuleSchema),
    answerLabelQuoting: z
      .object({
        enabled: z.boolean(),
        /**
         * Labels shorter than this are not checked. "Always consistent" and
         * "Drug Testing" occur in ordinary prose, and a rule that fires on them
         * would be noise — which is how a checker ends up disabled.
         */
        minWords: z.number().int().positive(),
        strictness: z.enum(['retry', 'warn']),
      })
      .strict(),
  })
  .strict();

export type VoiceConfig = z.infer<typeof voiceSchema>;
export type VoiceRule = z.infer<typeof voiceRuleSchema>;
