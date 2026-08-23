import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { SelectionModule } from '../selection/selection.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentValidator } from './assessment.validator';

@Module({
  imports: [SelectionModule, GenerationModule],
  controllers: [AssessmentController],
  providers: [AssessmentValidator],
})
export class AssessmentModule {}
