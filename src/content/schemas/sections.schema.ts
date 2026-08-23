import { z } from 'zod';
import { conditionSchema, localizedStringSchema } from './rule.schema';

/**
 * Schema for `content/report-templates/sections.json`.
 *
 * The model's output schema is derived from this file at runtime, so adding,
 * renaming or removing a section is a content edit rather than a code change.
 * The current build's nine sections are transcribed from the approved output
 * structure; the fixed-wording sections are new in Version 1.0.
 */

export const sectionTypeSchema = z.enum([
  /** A single block of prose. */
  'prose',
  /** An array of strings. */
  'list',
  /** An array of { recommendationId, headline, body } — ids are validated
   *  against exactly what the matrix selected. */
  'recommendationList',
  /** An array of { workshopId, whyThisFamily } — ids are validated against
   *  exactly what the matrix selected, after tier gating. */
  'workshopList',
  /**
   * Fixed wording the platform renders verbatim into every report it applies to.
   * The model is never shown it and never writes it — it is absent from the
   * generated schema, which is `.strict()`, so a model that returns it anyway
   * fails validation and is retried. That is what makes "this exact passage, in
   * every report" a guarantee rather than an instruction, and it is how the
   * Universal Guiding Principles ship.
   */
  'static',
]);

export const sectionSchema = z
  .object({
    key: z.string().min(1),
    order: z.number().int().positive(),
    type: sectionTypeSchema,
    title: localizedStringSchema,
    /** What the model is told to write. Absent on `static` sections. */
    instruction: localizedStringSchema.optional(),
    /** The verbatim copy for a `static` section. Absent on every other type. */
    text: localizedStringSchema.optional(),
    /**
     * When this section appears at all. Omitted means always.
     *
     * This is how the two urgent-only sections stay conditional, and how the
     * transition to the Sustaining Recovery Essential Workshop fires on the
     * non-scored gate rather than on severity. A section whose condition does not
     * hold is stripped before the model's schema and prompt are built, so the
     * model is never even offered it.
     */
    when: conditionSchema.optional(),
    /** Tiers this section appears at. Omitted means all tiers. */
    appliesAtTiers: z.array(z.string().min(1)).min(1).optional(),
    /** Guidance to the model, not hard-validated. */
    targetWords: z.tuple([z.number().int(), z.number().int()]).optional(),
    /** For `list` sections: the acceptable item-count range, inclusive. */
    listRange: z.tuple([z.number().int(), z.number().int()]).optional(),
    /** For `list` sections: render as a numbered list rather than bullets. */
    ordered: z.boolean().optional(),
  })
  .strict()
  .refine((s) => s.type !== 'list' || s.listRange !== undefined, {
    message: 'a section of type "list" must define listRange',
  })
  .refine((s) => s.type === 'static' || s.instruction !== undefined, {
    message:
      'every section except a "static" one must define instruction — without it the model is told nothing about what to write',
  })
  .refine((s) => s.type !== 'static' || s.text !== undefined, {
    message: 'a section of type "static" must define text',
  })
  .refine((s) => s.type === 'static' || s.text === undefined, {
    message:
      'only a "static" section may define text — on any other type the model writes the body and this would be silently ignored',
  })
  .refine((s) => s.type !== 'static' || s.targetWords === undefined, {
    message:
      'a "static" section has no word budget: the model does not write it',
  })
  .refine((s) => s.type !== 'static' || s.instruction === undefined, {
    message:
      'a "static" section must not define instruction — the model is never shown it, so an instruction here would be dead content that reads as if it were in force',
  });

export const sectionsSchema = z
  .object({
    version: z.string().min(1),
    sections: z.array(sectionSchema).min(1),
  })
  .strict();

export type ReportSectionsConfig = z.infer<typeof sectionsSchema>;
export type ReportSectionConfig = z.infer<typeof sectionSchema>;
export type SectionType = z.infer<typeof sectionTypeSchema>;
