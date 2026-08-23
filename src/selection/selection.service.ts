import { Injectable, Logger } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import type { Recommendation } from '../content/schemas/matrix.schema';
import { evaluate } from './rule.evaluator';
import { ScoringService } from './scoring.service';
import type {
  ExclusionRecord,
  GateAnswers,
  Responses,
  ScoredSubmission,
  SelectedRecommendation,
  SelectionResult,
} from './selection.types';

/**
 * Applies the recommendation matrix. Fully deterministic: the same submission and
 * the same matrix version always produce the same selection.
 *
 * **The model is not involved here and never sees this code.** It receives this
 * service's output and writes prose around it. That split is the point of the
 * upgrade — it makes the approved methodology actually govern, makes the outcome
 * auditable, and means a methodology revision is a content edit rather than a
 * prompt-engineering exercise.
 *
 * Guarantees, all covered in `test/unit/selection.spec.ts`:
 *   1. Exactly one primary recommendation, always.
 *   2. Supporting recommendations complement the primary rather than repeating
 *      it — anything in an exclusion relationship with the primary is dropped.
 *   3. No duplicates, capped at `maxSupporting` — except recommendations marked
 *      `alwaysInclude`, which appear whenever their rule matches.
 *   4. Total ordering: impact, then domain priority, then id. No ties survive.
 *   5. A resource the methodology forbids at this severity cannot reach the
 *      report, because it is removed before the model is told what exists.
 */
@Injectable()
export class SelectionService {
  private readonly logger = new Logger(SelectionService.name);

  constructor(
    private readonly content: ContentService,
    private readonly scoring: ScoringService,
  ) {}

  select(
    responses: Responses,
    urgentText?: string | null,
    gateAnswers: GateAnswers = {},
  ): SelectionResult {
    return this.selectFromScored(
      this.scoring.score(responses, urgentText, gateAnswers),
    );
  }

  selectFromScored(scored: ScoredSubmission): SelectionResult {
    const { matrix } = this.content;

    const tierId = this.resolveTier(scored);
    const exclusions: ExclusionRecord[] = [];

    // Recommendations and sections may read the resolved tier; the tiers
    // themselves cannot, which is why this is a second value rather than
    // something set on `scored` before tier resolution.
    const inTier: ScoredSubmission = { ...scored, tierId };

    const matched = matrix.recommendations.filter((rec) =>
      evaluate(rec.when, inTier),
    );
    const matchedIds = matched.map((r) => r.id);

    // Tier gating is applied to recommendations before the primary is chosen, so
    // a recommendation the methodology forbids at this severity can never win
    // the primary slot and then have to be unpicked.
    const permitted = matched.filter((rec) => {
      if (!rec.allowedTiers || rec.allowedTiers.includes(tierId)) return true;
      exclusions.push({
        droppedId: rec.id,
        excludedBy: `tier=${tierId}`,
        reason: 'forbidden-at-tier',
      });
      return false;
    });

    const { primary, usedDefaultPrimary } = this.choosePrimary(permitted);
    const supporting = this.chooseSupporting(permitted, primary, exclusions);

    if (usedDefaultPrimary) {
      // Not an error — the matrix defines a fallback precisely for this. But a
      // matrix that hits it often is under-specified, and that is worth knowing.
      this.logger.warn(
        `no primary-eligible recommendation matched; fell back to defaultPrimary "${primary.id}" (matrix ${matrix.version})`,
      );
    }

    const { workshopIds, gated } = this.collectWorkshops(
      primary,
      supporting,
      tierId,
    );
    for (const id of gated) {
      exclusions.push({
        droppedId: id,
        excludedBy: `tier=${tierId}`,
        reason: 'forbidden-at-tier',
      });
    }

    return {
      matrixVersion: matrix.version,
      methodologyVersion: matrix.methodologyVersion,
      scored: inTier,
      tierId,
      primary: toSelected(primary, 'primary'),
      supporting: supporting.map((rec) => toSelected(rec, 'supporting')),
      workshopIds,
      discussionGroupIds: this.collectDiscussionGroups(primary, supporting),
      audit: {
        matrixVersion: matrix.version,
        methodologyVersion: matrix.methodologyVersion,
        tierId,
        matchedRecommendationIds: matchedIds,
        usedDefaultPrimary,
        exclusions,
        tierGatedWorkshopIds: gated,
        domainScores: scored.domainScores,
        overallAverage: scored.overallAverage,
        topDomains: scored.topDomains,
      },
    };
  }

  /** First matching tier wins, so tier order in the matrix is significant.
   *  Boot validation guarantees the last tier is a catch-all. */
  private resolveTier(scored: ScoredSubmission): string {
    const tier = this.content.matrix.tiers.find((t) =>
      evaluate(t.when, scored),
    );
    if (!tier) {
      // Unreachable — boot validation requires a catch-all last tier.
      throw new Error(
        'no tier matched this submission, which should be impossible: the matrix must end in a catch-all tier',
      );
    }
    return tier.id;
  }

  private choosePrimary(matched: Recommendation[]): {
    primary: Recommendation;
    usedDefaultPrimary: boolean;
  } {
    const eligible = matched
      .filter((rec) => rec.eligibleAs.includes('primary'))
      .sort(this.byPriority);

    if (eligible.length > 0) {
      return { primary: eligible[0], usedDefaultPrimary: false };
    }

    // Every family gets exactly one primary recommendation. Boot validation
    // guarantees defaultPrimary exists, is primary-eligible, and is gated at no
    // tier — otherwise a family could reach a tier with no primary available.
    return {
      primary: this.content.recommendation(this.content.matrix.defaultPrimary),
      usedDefaultPrimary: true,
    };
  }

  /**
   * Builds the supporting set, dropping anything redundant.
   *
   * Exclusions are treated as **symmetric**: if A excludes B, the pair is
   * redundant, and which of the two happens to hold the primary slot does not
   * change that. Declaring it once in the matrix is enough.
   */
  private chooseSupporting(
    matched: Recommendation[],
    primary: Recommendation,
    exclusions: ExclusionRecord[],
  ): Recommendation[] {
    const { maxSupporting } = this.content.matrix;

    const candidates = matched
      .filter((rec) => rec.id !== primary.id)
      .filter((rec) => rec.eligibleAs.includes('supporting'))
      .sort(this.byPriority);

    const accepted: Recommendation[] = [];

    for (const candidate of candidates) {
      if (this.conflicts(candidate, primary)) {
        exclusions.push({
          droppedId: candidate.id,
          excludedBy: primary.id,
          reason: 'redundant-with-primary',
        });
        continue;
      }

      const clash = accepted.find((chosen) =>
        this.conflicts(candidate, chosen),
      );
      if (clash) {
        exclusions.push({
          droppedId: candidate.id,
          excludedBy: clash.id,
          reason: 'redundant-with-supporting',
        });
        continue;
      }

      // `alwaysInclude` survives the cap. Redundancy still applies above — an
      // exempt recommendation the primary excludes is still dropped, because
      // saying the same thing twice serves nobody.
      if (accepted.length >= maxSupporting && !candidate.alwaysInclude) {
        exclusions.push({
          droppedId: candidate.id,
          excludedBy: `maxSupporting=${maxSupporting}`,
          reason: 'over-max-supporting',
        });
        continue;
      }

      accepted.push(candidate);
    }

    return accepted;
  }

  private conflicts(a: Recommendation, b: Recommendation): boolean {
    return a.excludes.includes(b.id) || b.excludes.includes(a.id);
  }

  /**
   * Total ordering, so selection is reproducible regardless of array order in
   * the content file: higher educational impact first, then the domain's
   * position in `primaryTieBreak`, then id alphabetically as the final
   * tiebreaker.
   */
  private readonly byPriority = (
    a: Recommendation,
    b: Recommendation,
  ): number => {
    const byImpact = b.educationalImpact - a.educationalImpact;
    if (byImpact !== 0) return byImpact;

    const order = this.content.matrix.primaryTieBreak;
    const rank = (domainId: string): number => {
      const index = order.indexOf(domainId);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    const byDomain = rank(a.domainId) - rank(b.domainId);
    if (byDomain !== 0) return byDomain;

    return a.id.localeCompare(b.id);
  };

  /**
   * Primary's workshops first — they are the ones the report leads with — then
   * the supporting set's, deduplicated, then tier gating applied.
   *
   * Gating happens here rather than in the prompt because a resource the
   * methodology forbids at this severity must be impossible to cite, not merely
   * discouraged: "Early Warning Signs" in a SERIOUS plan tells a parent whose
   * child is actively using to watch for the first signs.
   *
   * `featuredWorkshopIds` reorders and never adds — a featured workshop no
   * selected recommendation routed to does not appear, because the matrix
   * decides what a family receives and this does not.
   */
  private collectWorkshops(
    primary: Recommendation,
    supporting: Recommendation[],
    tierId: string,
  ): { workshopIds: string[]; gated: string[] } {
    const seen = new Set<string>();
    const selected: string[] = [];
    for (const id of [primary, ...supporting].flatMap((r) => r.workshopIds)) {
      if (seen.has(id)) continue;
      seen.add(id);
      selected.push(id);
    }

    const forbidden = this.content.forbiddenWorkshopIdsAtTier(tierId);
    const gated = selected.filter((id) => forbidden.has(id));
    const permitted = selected.filter((id) => !forbidden.has(id));

    const featured = this.content.workshops.featuredWorkshopIds.filter((id) =>
      permitted.includes(id),
    );
    if (featured.length === 0) return { workshopIds: permitted, gated };

    const promoted = new Set(featured);
    return {
      workshopIds: [
        ...featured,
        ...permitted.filter((id) => !promoted.has(id)),
      ],
      gated,
    };
  }

  private collectDiscussionGroups(
    primary: Recommendation,
    supporting: Recommendation[],
  ): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of [primary, ...supporting].flatMap(
      (r) => r.discussionGroupIds,
    )) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }
}

function toSelected(
  rec: Recommendation,
  role: 'primary' | 'supporting',
): SelectedRecommendation {
  return {
    id: rec.id,
    domainId: rec.domainId,
    educationalImpact: rec.educationalImpact,
    role,
  };
}
