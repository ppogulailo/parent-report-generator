import { Injectable } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import type {
  GateAnswers,
  Responses,
  ScoredSubmission,
} from './selection.types';

/**
 * Turns a submission into the signals the matrix reads.
 *
 * **This is a faithful port of the live scoring service, not an improvement on
 * it.** Every arithmetic decision below matches the behaviour in
 * `src/report/scoring/scoring.service.ts` and `computeSeverityTier`, because the
 * brief is to preserve the approved risk logic exactly. Three of those decisions
 * look like defects and are not:
 *
 *   1. **Domains overlap.** q18 and q22 each count toward two domains. Averaging
 *      per domain from the domain's own question list preserves that; a
 *      one-domain-per-question model would change every score.
 *
 *   2. **`overallAverage` is the mean of the domain means, not of the answers.**
 *      With overlapping domains and unequal weighting those differ. The live
 *      severity gate uses the mean of domain means, so that is what this returns.
 *
 *   3. **`overallAverage` is deliberately NOT rounded**, even though each domain
 *      average is rounded to 2 decimals. The live gate compares the unrounded
 *      value against 2.75 and 2.0. Rounding first would move a family across a
 *      tier boundary at exactly 2.745 — a real behaviour change dressed up as
 *      tidying.
 *
 * The one intentional difference: answers arrive keyed by question id rather
 * than by array position, so reordering the questionnaire can no longer re-map a
 * parent's answers onto different questions.
 */
@Injectable()
export class ScoringService {
  constructor(private readonly content: ContentService) {}

  score(
    responses: Responses,
    urgentText?: string | null,
    gateAnswers: GateAnswers = {},
  ): ScoredSubmission {
    const { assessment } = this.content;
    const { min, max } = assessment.scale;

    const normalisedResponses: Responses = {};
    for (const question of assessment.questions) {
      normalisedResponses[question.id] = this.normalise(
        responses[question.id],
        min,
        max,
      );
    }

    const domainScores: Record<string, number> = {};
    for (const domain of assessment.domains) {
      const values = domain.questionIds.map(
        (id) => normalisedResponses[id] ?? this.midpoint(min, max),
      );
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      domainScores[domain.id] = round2(avg);
    }

    const domainValues = Object.values(domainScores);

    return {
      domainScores,
      // Unrounded on purpose — see the class comment, point 3.
      overallAverage:
        domainValues.length > 0
          ? domainValues.reduce((a, b) => a + b, 0) / domainValues.length
          : this.midpoint(min, max),
      topDomains: this.rankDomains(domainScores),
      normalisedResponses,
      valueCounts: this.countValues(normalisedResponses, min, max),
      urgentTextPresent: (urgentText ?? '').trim().length > 0,
      gateAnswers,
    };
  }

  /**
   * Ranked most concerning first. Ties break on the approved tie-break order, so
   * the ranking is reproducible rather than dependent on object key order.
   *
   * Returns the top three, matching the live `topN`.
   */
  private rankDomains(domainScores: Record<string, number>): string[] {
    const order = this.content.assessment.tieBreakOrder;
    const rank = (id: string): number => {
      const index = order.indexOf(id);
      // A domain missing from the tie-break order sorts last rather than first.
      // `indexOf` returning -1 would otherwise promote it above every named
      // domain — the live code has this bug latent; boot validation here
      // requires the order to name every domain, so it cannot be reached.
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return Object.keys(domainScores)
      .sort((a, b) => {
        const diff = domainScores[b] - domainScores[a];
        if (diff !== 0) return diff;
        return rank(a) - rank(b);
      })
      .slice(0, 3);
  }

  private countValues(
    responses: Responses,
    min: number,
    max: number,
  ): Record<number, number> {
    const counts: Record<number, number> = {};
    for (let v = min; v <= max; v++) counts[v] = 0;
    for (const value of Object.values(responses)) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * Missing or unusable answers fill with the scale midpoint, floored — 2 on a
   * 1–4 scale, matching the live fill-with-2. Floor rather than round because
   * rounding 2.5 up to 3 would make an unanswered question lean toward concern
   * and could tip a family into a higher tier.
   *
   * Validation rejects incomplete submissions before they reach here, so this
   * only guards against a question added to content between a parent starting
   * and finishing.
   */
  private normalise(
    value: number | undefined | null,
    min: number,
    max: number,
  ): number {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return this.midpoint(min, max);
    }
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  private midpoint(min: number, max: number): number {
    return Math.floor((min + max) / 2);
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
