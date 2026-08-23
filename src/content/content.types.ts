import type { Assessment } from './schemas/assessment.schema';
import type { RecommendationMatrix } from './schemas/matrix.schema';
import type { ReportSectionsConfig } from './schemas/sections.schema';
import type { Workshops } from './schemas/workshops.schema';

export type Language = 'en' | 'es';

export const LANGUAGES: readonly Language[] = ['en', 'es'] as const;

/** Everything in `content/`, parsed and validated. Immutable after boot. */
export interface ContentBundle {
  assessment: Assessment;
  workshops: Workshops;
  matrix: RecommendationMatrix;
  sections: ReportSectionsConfig;
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
