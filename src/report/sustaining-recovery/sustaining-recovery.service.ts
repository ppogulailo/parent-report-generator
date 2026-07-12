import { Injectable, Logger } from '@nestjs/common';
import { ScoringService } from '../scoring/scoring.service';
import {
  ClaudeService,
  RetryableGenerationError,
} from '../claude/claude.service';
import { GenerateSustainingRecoveryDto } from './sr-generate-report.dto';
import { SR_DOMAIN_MAP, SR_TIE_BREAK_ORDER } from './sr-domain.map';
import { SR_SYSTEM_PROMPT } from './sr-system.prompt';
import { SR_SYSTEM_PROMPT_ES } from './sr-system.prompt.es';
import {
  SustainingRecoveryReportSections,
  buildSustainingRecoveryUserPrompt,
  parseSustainingRecoverySections,
} from './sr-user.prompt';
import type { Language } from '../dto/generate-report.dto';

export interface GenerateSustainingRecoveryResponse {
  success: true;
  reportType: 'sustaining-recovery';
  /** Scaffold marker — this report type ships DRAFT content pending founder review. */
  draft: true;
  domainScores: Record<string, number>;
  topDomains: string[];
  report: SustainingRecoveryReportSections;
}

@Injectable()
export class SustainingRecoveryService {
  private readonly logger = new Logger(SustainingRecoveryService.name);

  constructor(
    private readonly scoringService: ScoringService,
    private readonly claudeService: ClaudeService,
  ) {}

  private systemFor(language: Language): string {
    return language === 'es' ? SR_SYSTEM_PROMPT_ES : SR_SYSTEM_PROMPT;
  }

  private score(responses: number[]) {
    return this.scoringService.calculateScores(
      responses,
      SR_DOMAIN_MAP,
      SR_TIE_BREAK_ORDER,
    );
  }

  async generate(
    dto: GenerateSustainingRecoveryDto,
  ): Promise<GenerateSustainingRecoveryResponse> {
    const language = dto.language ?? 'en';
    const { domainScores, topDomains } = this.score(dto.responses);

    const userPrompt = buildSustainingRecoveryUserPrompt(
      domainScores,
      topDomains,
      dto.responses,
      language,
      dto.crisis,
    );
    const text = await this.claudeService.complete(
      this.systemFor(language),
      userPrompt,
    );
    const report = parseSustainingRecoverySections(text, language);

    return {
      success: true,
      reportType: 'sustaining-recovery',
      draft: true,
      domainScores,
      topDomains,
      report,
    };
  }

  async *generateStream(dto: GenerateSustainingRecoveryDto): AsyncGenerator<
    | {
        type: 'scores';
        domainScores: Record<string, number>;
        topDomains: string[];
        language: Language;
        reportType: 'sustaining-recovery';
      }
    | { type: 'text'; text: string }
    | { type: 'reset' }
    | { type: 'done' }
  > {
    const language = dto.language ?? 'en';
    const { domainScores, topDomains } = this.score(dto.responses);

    yield {
      type: 'scores',
      domainScores,
      topDomains,
      language,
      reportType: 'sustaining-recovery',
    };

    const userPrompt = buildSustainingRecoveryUserPrompt(
      domainScores,
      topDomains,
      dto.responses,
      language,
      dto.crisis,
    );
    const systemPrompt = this.systemFor(language);

    // Same drop-resistant retry loop as the intervention stream: a dropped
    // stream emits `reset` so the client clears the partial plan, then we
    // regenerate from scratch.
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        for await (const chunk of this.claudeService.completeStream(
          systemPrompt,
          userPrompt,
        )) {
          yield { type: 'text', text: chunk };
        }
        break;
      } catch (err) {
        if (err instanceof RetryableGenerationError && attempt < maxAttempts) {
          this.logger.warn(
            `SR stream ended incomplete (attempt ${attempt}); resetting and retrying`,
          );
          yield { type: 'reset' };
          await new Promise((r) => setTimeout(r, err.retryAfterMs));
          continue;
        }
        throw err;
      }
    }

    yield { type: 'done' };
  }
}
