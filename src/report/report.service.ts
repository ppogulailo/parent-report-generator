import { Injectable } from '@nestjs/common';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ScoringService } from './scoring/scoring.service';
import { ClaudeService } from './claude/claude.service';
import {
  DomainScores,
  GenerateReportResponse,
} from './interfaces/report.interface';

@Injectable()
export class ReportService {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly claudeService: ClaudeService,
  ) {}

  async generate(dto: GenerateReportDto): Promise<GenerateReportResponse> {
    const { domainScores, topDomains } = this.scoringService.calculateScores(
      dto.responses,
    );
    const report = await this.claudeService.generateReport(
      domainScores,
      topDomains,
    );

    return {
      success: true,
      domainScores: domainScores as unknown as DomainScores,
      topDomains,
      report,
    };
  }

  async *generateStream(
    dto: GenerateReportDto,
  ): AsyncGenerator<
    | { type: 'scores'; domainScores: Record<string, number>; topDomains: string[] }
    | { type: 'text'; text: string }
    | { type: 'done' }
  > {
    const { domainScores, topDomains } = this.scoringService.calculateScores(
      dto.responses,
    );

    yield { type: 'scores', domainScores, topDomains };

    for await (const chunk of this.claudeService.generateReportStream(
      domainScores,
      topDomains,
    )) {
      yield { type: 'text', text: chunk };
    }

    yield { type: 'done' };
  }
}