import { Injectable } from '@nestjs/common';
import { DOMAIN_MAP, TIE_BREAK_ORDER } from './domain.map';

@Injectable()
export class ScoringService {
  calculateScores(responses: number[]): {
    domainScores: Record<string, number>;
    topDomains: string[];
  } {
    const domainScores: Record<string, number> = {};

    for (const [domain, indices] of Object.entries(DOMAIN_MAP)) {
      const values = indices.map((i) => this.normalise(responses[i]));
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      domainScores[domain] = Math.round(avg * 100) / 100;
    }

    const ranked = Object.keys(domainScores).sort((a, b) => {
      const diff = domainScores[b] - domainScores[a];
      if (diff !== 0) return diff;
      return TIE_BREAK_ORDER.indexOf(a) - TIE_BREAK_ORDER.indexOf(b);
    });

    return { domainScores, topDomains: ranked.slice(0, 3) };
  }

  private normalise(value: number | undefined | null): number {
    if (value === undefined || value === null || Number.isNaN(value)) return 2;
    if (value < 1) return 1;
    if (value > 4) return 4;
    return value;
  }
}
