import { z } from 'zod';
import { conditionSchema, localizedStringSchema } from './rule.schema';

/**
 * Schema for `content/recommendation-matrix.json` — the governing document.
 *
 * The matrix decides what a family receives. The model only writes prose around
 * that decision. Everything selection-related is expressed here as data.
 *
 * Ported from the Sustaining Recovery FRAAP with one addition the approved
 * Monitoring & Intervention methodology requires: **tier gating**. In Sustaining
 * Recovery a workshop is either routed to or not. Here, several resources are
 * legitimate at one severity and explicitly wrong at another — "Early Warning
 * Signs" must not appear in a SERIOUS plan because the family is past that
 * stage, and drug testing, behavioural contracts and therapist referral must not
 * appear as immediate steps in a MILD one. That is a routing rule, so it lives
 * in the matrix rather than in a prompt.
 */

export const eligibilitySchema = z.enum(['primary', 'supporting']);

export const recommendationSchema = z
  .object({
    id: z.string().min(1),
    domainId: z.string().min(1),
    /** Client-authored name for the priority area. Shown to the parent. */
    title: localizedStringSchema,
    /** What the recommendation actually means. Given to the model as the spine
     *  of the prose it writes, so it cannot drift into generic advice. */
    intent: localizedStringSchema,
    eligibleAs: z.array(eligibilitySchema).min(1),
    /** Ranking weight. Higher wins the primary slot and sorts earlier among
     *  supporting recommendations. */
    educationalImpact: z.number(),
    /** Recommendations that must NOT appear alongside this one — the mechanism
     *  that keeps the supporting set complementary rather than repetitive. */
    excludes: z.array(z.string().min(1)),
    /**
     * Exempt from `maxSupporting` — if its rule matches, it is in the report,
     * however many others also matched.
     *
     * For guidance the methodology states as an absolute rather than a ranking.
     * The parent's own peer-support routing is the clearest case: it is required
     * at every severity, and the harder a family's situation the more rules match,
     * so without this the most universal recommendation is the one the cap drops.
     */
    alwaysInclude: z.boolean().optional(),
    workshopIds: z.array(z.string().min(1)),
    /**
     * Discussion groups this recommendation routes to.
     *
     * Separate from `workshopIds` because the methodology treats them as
     * different instruments and says so repeatedly: groups are peer support,
     * workshops are how a parent learns to address a specific problem, and
     * substituting a group where the routing table names a workshop is a
     * violation. Keeping them in one list would lose that distinction.
     */
    discussionGroupIds: z.array(z.string().min(1)),
    /**
     * Severity tiers this recommendation may appear in. Omitted means all tiers.
     * A recommendation whose rule matches but whose tier is excluded is dropped
     * with an audit record, never silently.
     */
    allowedTiers: z.array(z.string().min(1)).min(1).optional(),
    when: conditionSchema,
    notes: z.string().optional(),
  })
  .strict();

export const tierSchema = z
  .object({
    id: z.string().min(1),
    /** The tier name as the methodology states it — MILD / MODERATE / SERIOUS /
     *  CRITICAL. Recorded on the report. */
    label: localizedStringSchema,
    /** Parent-facing sentence explaining what the tier means. Distinct from
     *  `toneGuidance`, which is an instruction to the model and must never be
     *  shown to a parent. */
    description: localizedStringSchema,
    when: conditionSchema,
    /** Injected into the prompt. Tone is a deterministic decision, not the
     *  model's to make. Never rendered. */
    toneGuidance: z.string().min(1),
  })
  .strict();

/**
 * A resource that is wrong at a given severity.
 *
 * Enforced at selection time: a gated workshop is removed from the family's
 * workshop list before the model is ever told about it, so it cannot be cited.
 * Boot validation rejects a gate naming an unknown workshop or tier.
 */
export const tierGateSchema = z
  .object({
    workshopIds: z.array(z.string().min(1)).min(1),
    forbiddenAtTiers: z.array(z.string().min(1)).min(1),
    /** Why the methodology forbids it here. Read by humans, not by code. */
    reason: z.string().min(1),
  })
  .strict();

export const matrixSchema = z
  .object({
    version: z.string().min(1),
    status: z.enum(['placeholder', 'draft', 'approved']),
    /** The assessment version this matrix was written against. Mismatches are
     *  reported at boot — a matrix keyed to old question ids is a silent
     *  correctness bug otherwise. */
    assessmentVersion: z.string().min(1),
    /** The approved methodology version this matrix transcribes. */
    methodologyVersion: z.string().min(1),
    maxSupporting: z.number().int().nonnegative(),
    /** Fallback primary when no primary-eligible rule matches. Never null:
     *  every family must receive exactly one primary recommendation. */
    defaultPrimary: z.string().min(1),
    primaryTieBreak: z.array(z.string().min(1)).min(1),
    tiers: z.array(tierSchema).min(1),
    tierGates: z.array(tierGateSchema),
    recommendations: z.array(recommendationSchema).min(1),
  })
  .strict();

export type RecommendationMatrix = z.infer<typeof matrixSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type Tier = z.infer<typeof tierSchema>;
export type TierGate = z.infer<typeof tierGateSchema>;
export type Eligibility = z.infer<typeof eligibilitySchema>;
