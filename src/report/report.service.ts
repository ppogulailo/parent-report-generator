import { Injectable, Logger } from '@nestjs/common';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ScoringService } from './scoring/scoring.service';
import {
  ClaudeService,
  RetryableGenerationError,
} from './claude/claude.service';
import {
  DomainScores,
  GenerateReportResponse,
} from './interfaces/report.interface';
import { validateReportResources } from './validation/resource-validator';
import { computeSeverityTier } from './prompts/user.prompt';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly scoringService: ScoringService,
    private readonly claudeService: ClaudeService,
  ) {}

  async generate(dto: GenerateReportDto): Promise<GenerateReportResponse> {
    const language = dto.language ?? 'en';
    const { domainScores, topDomains } = this.scoringService.calculateScores(
      dto.responses,
    );
    const report = await this.claudeService.generateReport(
      domainScores,
      topDomains,
      dto.responses,
      language,
      dto.crisis,
    );

    const warnings = validateReportResources(report);
    if (warnings.length > 0) {
      this.logger.warn(
        `Resource-reference warnings (${language}): ${warnings
          .map((w) => `[${w.kind}] ${w.detail}`)
          .join('; ')}`,
      );
    }

    return {
      success: true,
      domainScores: domainScores as unknown as DomainScores,
      topDomains,
      report,
    };
  }

  async *generateStream(dto: GenerateReportDto): AsyncGenerator<
    | {
        type: 'scores';
        domainScores: Record<string, number>;
        topDomains: string[];
        language: 'en' | 'es';
        severity: 'MILD' | 'MODERATE' | 'SERIOUS';
      }
    | { type: 'text'; text: string }
    | { type: 'reset' }
    | { type: 'done' }
  > {
    const language = dto.language ?? 'en';
    const { domainScores, topDomains } = this.scoringService.calculateScores(
      dto.responses,
    );

    const severity = computeSeverityTier(dto.responses, domainScores, dto.crisis);
    yield { type: 'scores', domainScores, topDomains, language, severity };

    // If a stream drops mid-generation, the text already sent is incomplete.
    // Emit a `reset` so the client clears the partial plan, wait, then
    // regenerate from scratch — the user never sees a truncated report.
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        for await (const chunk of this.claudeService.generateReportStream(
          domainScores,
          topDomains,
          dto.responses,
          language,
          dto.crisis,
        )) {
          yield { type: 'text', text: chunk };
        }
        break;
      } catch (err) {
        if (err instanceof RetryableGenerationError && attempt < maxAttempts) {
          this.logger.warn(
            `Stream ended incomplete (attempt ${attempt}); resetting and retrying`,
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
