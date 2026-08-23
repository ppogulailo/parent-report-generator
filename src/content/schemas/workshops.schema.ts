import { z } from 'zod';
import { localizedStringSchema } from './rule.schema';

/** Schema for `content/workshops.json` — the resource library and the wording
 *  rules that are verified rather than merely requested. */

export const workshopCategorySchema = z.enum(['essential', 'auxiliary']);

/**
 * A link a parent is asked to follow, or null while the client still owes it.
 *
 * Requiring HTTPS at load time means a mistyped or copied-from-an-old-doc
 * `http://` link fails the content drop rather than shipping into a report — a
 * parent follows this into a members-only community and signs in behind it.
 */
const resourceUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), {
    message: 'must be an https:// URL — a parent follows this link to sign in',
  })
  .nullable();

export const workshopSchema = z
  .object({
    id: z.string().min(1),
    category: workshopCategorySchema,
    /**
     * Cited verbatim in report output, and never translated — these are program
     * resource names, not prose. The Spanish report cites the English title.
     */
    title: z.string().min(1),
    summary: z.string().min(1),
    /** Null until the client supplies it. Boot logs a warning, does not fail. */
    url: resourceUrlSchema,
    applicableDomains: z.array(z.string().min(1)).min(1),
    /**
     * True where the domains were inferred from the workshop's topic rather than
     * stated by the approved routing table. Flagged rather than hidden: an
     * inferred mapping is a guess about the client's methodology, and a reviewer
     * should be able to see which ones need confirming.
     */
    domainsInferred: z.boolean(),
    /**
     * Kept in the library but never routed to. Boot validation FAILS if the
     * matrix names it, so "never recommend this one" is enforced rather than
     * remembered.
     */
    neverRecommend: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const discussionGroupSchema = z
  .object({
    id: z.string().min(1),
    /** Cited verbatim and never translated, exactly like a workshop title. */
    name: z.string().min(1),
    usage: z.string().min(1),
    url: resourceUrlSchema,
  })
  .strict();

/** Per-language string lists. A rule whose wording is deliberately identical in
 *  both languages repeats it — being explicit beats an `untranslated` flag that
 *  a reader has to remember the meaning of. */
const localizedListSchema = z
  .object({
    en: z.array(z.string().min(1)).min(1),
    es: z.array(z.string().min(1)).min(1),
  })
  .strict();

/**
 * Wording the methodology states as literal output, and how strictly to check
 * that the model actually produced it.
 *
 * The prompt instructs these. This is what verifies the model complied, because
 * during Sustaining Recovery testing the professional-help sequence turned out
 * to be honoured only intermittently — present in one report and absent from six
 * paragraphs of another two days later — and nothing was checking. Intermittent
 * is worse than broken: nobody notices a parent quietly not receiving the route
 * to ASAP's vetted providers.
 *
 * `scope` and `strictness` are content rather than code so the client can tighten
 * a rule without an engineer.
 */
export const requiredWordingSchema = z
  .object({
    id: z.string().min(1),
    /** What the rule is, for whoever reads a validation failure. */
    description: z.string().min(1),
    /**
     * `at-least-once` — the wording must appear somewhere in the report.
     * `every-paragraph` — in every paragraph that mentions a trigger term.
     *
     * The professional-help rule reads "every paragraph" in the methodology.
     * Enforced literally that pushes two long boilerplate sentences into every
     * bullet of a priorities list, so it ships as `at-least-once`, which
     * guarantees the parent gets the route without wrecking the lists. Changing
     * it here is the client's call, not an engineering task.
     */
    scope: z.enum(['at-least-once', 'every-paragraph']),
    /** Terms that mean the rule is in play. Narrower than the prompt's list on
     *  purpose — see the comments in `workshops.json`. */
    triggers: localizedListSchema,
    /** Cited verbatim, in this order, in the same paragraph. */
    sentences: localizedListSchema,
    /** Tiers the rule applies at. Omitted means all tiers. The standardized
     *  closing, for instance, is excluded from MILD by the methodology. */
    appliesAtTiers: z.array(z.string().min(1)).min(1).optional(),
    /**
     * `retry` — a violation regenerates the report, and if it survives every
     * attempt the report ships with a loud warning rather than costing a parent
     * their plan. `warn` — logged only.
     */
    strictness: z.enum(['retry', 'warn']),
  })
  .strict();

export const workshopsSchema = z
  .object({
    version: z.string().min(1),
    status: z.string().min(1),
    categoryLabels: z
      .object({
        essential: localizedStringSchema,
        auxiliary: localizedStringSchema,
      })
      .strict(),
    workshops: z.array(workshopSchema).min(1),
    /**
     * Workshops that lead the list wherever workshops are shown, in this order.
     * Applied after selection, so it reorders and never adds: a featured
     * workshop the matrix did not select does not appear.
     */
    featuredWorkshopIds: z.array(z.string().min(1)),
    discussionGroups: z.array(discussionGroupSchema).min(1),
    requiredWording: z.array(requiredWordingSchema),
    /**
     * Titles that must never reach a parent — hallucinated resources, retired
     * ones, and real workshops the methodology excludes from this plan. Checked
     * against generated prose, so a title the model remembers from its training
     * data cannot come back.
     */
    bannedTitles: z
      .object({
        workshops: z.array(z.string().min(1)),
        discussionGroups: z.array(z.string().min(1)),
        /** Foundational text taught inside the workshops. Never cited to a
         *  parent as a reading recommendation. */
        articlesOfAction: z.array(z.string().min(1)),
      })
      .strict(),
  })
  .strict();

export type Workshops = z.infer<typeof workshopsSchema>;
export type Workshop = z.infer<typeof workshopSchema>;
export type WorkshopCategory = z.infer<typeof workshopCategorySchema>;
export type DiscussionGroup = z.infer<typeof discussionGroupSchema>;
export type RequiredWording = z.infer<typeof requiredWordingSchema>;
