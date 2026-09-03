import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { RenderModule } from '../render/render.module';
import { SelectionModule } from '../selection/selection.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentValidator } from './assessment.validator';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [SelectionModule, GenerationModule, RenderModule],
  controllers: [AssessmentController, PlanController],
  providers: [AssessmentValidator, PlanService],
})
export class AssessmentModule {}
