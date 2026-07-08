import { Injectable } from '@nestjs/common';
import { DOMAIN_MAP, TIE_BREAK_ORDER } from './domain.map';

@Injectable()
export class ScoringService {
  /**
   * Score a questionnaire into domain averages and rank the top domains.
   * Defaults to the early-intervention 24-question map; the Sustaining Recovery
   * plan passes its own `map` / `tieBreakOrder` (see sr-domain.map.ts). The
   * algorithm is questionnaire-agnostic — it just averages the indices each
   * domain owns, so any question count works.
   */
  calculateScores(
    responses: number[],
    map: Record<string, number[]> = DOMAIN_MAP,
    tieBreakOrder: string[] = TIE_BREAK_ORDER,
    topN = 3,
  ): {
    domainScores: Record<string, number>;
    topDomains: string[];
  } {
    const domainScores: Record<string, number> = {};

    for (const [domain, indices] of Object.entries(map)) {
      const values = indices.map((i) => this.normalise(responses[i]));
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      domainScores[domain] = Math.round(avg * 100) / 100;
    }

    const ranked = Object.keys(domainScores).sort((a, b) => {
      const diff = domainScores[b] - domainScores[a];
      if (diff !== 0) return diff;
      return tieBreakOrder.indexOf(a) - tieBreakOrder.indexOf(b);
    });

    return { domainScores, topDomains: ranked.slice(0, topN) };
  }

  private normalise(value: number | undefined | null): number {
    if (value === undefined || value === null || Number.isNaN(value)) return 2;
    if (value < 1) return 1;
    if (value > 4) return 4;
    return value;
  }
}
