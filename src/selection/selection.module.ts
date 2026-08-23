import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { SelectionService } from './selection.service';

@Module({
  providers: [ScoringService, SelectionService],
  exports: [ScoringService, SelectionService],
})
export class SelectionModule {}
