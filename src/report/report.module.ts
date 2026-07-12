import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ScoringService } from './scoring/scoring.service';
import { ClaudeService } from './claude/claude.service';
import { SustainingRecoveryController } from './sustaining-recovery/sustaining-recovery.controller';
import { SustainingRecoveryService } from './sustaining-recovery/sustaining-recovery.service';

@Module({
  imports: [HttpModule],
  controllers: [ReportController, SustainingRecoveryController],
  providers: [
    ReportService,
    ScoringService,
    ClaudeService,
    SustainingRecoveryService,
  ],
})
export class ReportModule {}
