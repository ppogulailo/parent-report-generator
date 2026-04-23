import { Injectable, Logger } from '@nestjs/common';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ScoringService } from './scoring/scoring.service';
import { ClaudeService } from './claude/claude.service';
import {
  DomainScores,
  GenerateReportResponse,
} from './interfaces/report.interface';
import { validateReportResources } from './validation/resource-validator';

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
      }
    | { type: 'text'; text: string }
    | { type: 'done' }
  > {
    const language = dto.language ?? 'en';
    const { domainScores, topDomains } = this.scoringService.calculateScores(
      dto.responses,
    );

    yield { type: 'scores', domainScores, topDomains, language };

    for await (const chunk of this.claudeService.generateReportStream(
      domainScores,
      topDomains,
      dto.responses,
      language,
    )) {
      yield { type: 'text', text: chunk };
    }

    yield { type: 'done' };
  }
}
