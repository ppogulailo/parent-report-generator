import type { Assessment } from './schemas/assessment.schema';
import type { RecommendationMatrix } from './schemas/matrix.schema';
import type { ReportSectionsConfig } from './schemas/sections.schema';
import type { Workshops } from './schemas/workshops.schema';

export type Language = 'en' | 'es';

export const LANGUAGES: readonly Language[] = ['en', 'es'] as const;

/** Prompt templates, read from `content/report-templates/`. */
export interface PromptTemplates {
  system: Record<Language, string>;
  user: Record<Language, string>;
}

/**
 * Every placeholder the prompt builder knows how to fill.
 *
 * Validated at boot in both directions: a template using a placeholder that is
 * not here fails, and so does a template missing one that carries the family's
 * actual data. The first would ship the literal text `{{RESOURCES}}` to a model;
 * the second would ship a plan written from nothing in particular, which is far
 * worse because it still reads fine.
 */
export const PROMPT_PLACEHOLDERS = [
  'TIER_LABEL',
  'TONE_GUIDANCE',
  'EVIDENCE',
  'URGENT_BLOCK',
  'RECOMMENDATIONS',
  'RESOURCES',
  'REQUIRED_WORDING',
  'SECTIONS',
  'LANGUAGE_NAME',
] as const;

/** Placeholders a user template must contain — the ones carrying this family's
 *  data. Omitting one is silent generic-ness, so it is fatal. */
export const REQUIRED_USER_PLACEHOLDERS = [
  'TONE_GUIDANCE',
  'EVIDENCE',
  'RECOMMENDATIONS',
  'RESOURCES',
  'SECTIONS',
] as const;

/** Everything in `content/`, parsed and validated. Immutable after boot. */
export interface ContentBundle {
  assessment: Assessment;
  workshops: Workshops;
  matrix: RecommendationMatrix;
  sections: ReportSectionsConfig;
  templates: PromptTemplates;
  /** Non-fatal problems worth surfacing at boot — missing workshop URLs,
   *  inferred domain mappings, placeholder or draft content still in place. */
  warnings: string[];
}

/** Thrown when `content/` is invalid. Fatal: the app must not boot.
 *
 *  Failing at boot rather than on first request is deliberate. A parent
 *  submitting an assessment is the worst possible moment to discover that a
 *  routing rule names a workshop that does not exist. */
export class ContentValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `content/ failed validation with ${problems.length} problem(s):\n` +
        problems.map((p) => `  · ${p}`).join('\n'),
    );
    this.name = 'ContentValidationError';
  }
}
