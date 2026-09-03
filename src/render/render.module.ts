import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PlanRenderer } from './plan.renderer';

@Module({
  providers: [PlanRenderer, PdfService],
  exports: [PlanRenderer, PdfService],
})
export class RenderModule {}
