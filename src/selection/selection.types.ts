/** Shared types for scoring and matrix selection. */

/** A parent's scored answers, keyed by question id — never by array position.
 *  The live system uses a positional array, which silently re-maps old answers
 *  onto new questions the moment the questionnaire is reordered. */
export type Responses = Record<string, number>;

/** Answers to the non-scored gating questions, keyed by gate id. */
export type GateAnswers = Record<string, string>;

/** The scoring stage's output. */
export interface ScoredSubmission {
  /** Domain id → average of that domain's questions, rounded to 2 decimals. */
  domainScores: Record<string, number>;
  /** Mean of the domain averages, rounded to 2 decimals. Matches the live
   *  system's `avg`, which is also a mean of domain means rather than of
   *  answers — with overlapping domains the two differ, so this is preserved
   *  exactly rather than "corrected". */
  overallAverage: number;
  /** Domain ids ranked most concerning first, ties broken deterministically. */
  topDomains: string[];
  /** Answers normalised into the scale and filled where missing. */
  normalisedResponses: Responses;
  /** How many answers sit at each scale value — used by `answeredCount` rules. */
  valueCounts: Record<number, number>;
  /** Whether the parent wrote anything in the optional urgent-concern field. */
  urgentTextPresent: boolean;
  /** Non-scored gate answers. Cannot influence any score above. */
  gateAnswers: GateAnswers;
  /**
   * The resolved severity tier, set by the selection service after tier
   * resolution and before recommendations are evaluated.
   *
   * Absent while the tiers themselves are being resolved, which is what makes a
   * `tier` condition inside a tier rule impossible rather than merely wrong.
   */
  tierId?: string;
}

/** One recommendation the matrix selected, with why. */
export interface SelectedRecommendation {
  id: string;
  domainId: string;
  educationalImpact: number;
  role: 'primary' | 'supporting';
}

/** Records why a recommendation or resource was dropped, so selection stays
 *  auditable — "why didn't this family get X?" is as important as "why did
 *  they get Y?". */
export interface ExclusionRecord {
  droppedId: string;
  excludedBy: string;
  reason:
    | 'redundant-with-primary'
    | 'redundant-with-supporting'
    | 'over-max-supporting'
    | 'forbidden-at-tier';
}

/** The full deterministic decision. Contains no generated prose. */
export interface SelectionResult {
  matrixVersion: string;
  methodologyVersion: string;
  scored: ScoredSubmission;
  tierId: string;
  primary: SelectedRecommendation;
  supporting: SelectedRecommendation[];
  /** Union of the selected recommendations' workshops, primary's first, with
   *  anything forbidden at this tier already removed. */
  workshopIds: string[];
  /** Union of the selected recommendations' discussion groups. */
  discussionGroupIds: string[];
  audit: SelectionAudit;
}

/** The audit trail ASAP's team can read to answer "why this family?". */
export interface SelectionAudit {
  matrixVersion: string;
  methodologyVersion: string;
  tierId: string;
  /** Every recommendation whose rule matched, before exclusions were applied. */
  matchedRecommendationIds: string[];
  /** True when no primary-eligible rule matched and `defaultPrimary` was used —
   *  worth surfacing, because a matrix that hits this often is under-specified. */
  usedDefaultPrimary: boolean;
  exclusions: ExclusionRecord[];
  /** Workshops removed because the methodology forbids them at this severity. */
  tierGatedWorkshopIds: string[];
  domainScores: Record<string, number>;
  overallAverage: number;
  topDomains: string[];
}
