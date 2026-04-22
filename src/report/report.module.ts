import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ScoringService } from './scoring/scoring.service';
import { ClaudeService } from './claude/claude.service';

@Module({
  imports: [HttpModule],
  controllers: [ReportController],
  providers: [ReportService, ScoringService, ClaudeService],
})
export class ReportModule {}
