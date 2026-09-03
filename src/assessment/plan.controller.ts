import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { PdfService, PdfUnavailableError } from '../render/pdf.service';
import { PlanService } from './plan.service';

/**
 * The private return link's server side.
 *
 * The plan id is the capability: an unguessable UUID that only the family's
 * browser ever saw. There are no accounts, so possession of the link is what
 * authorises reading — and deleting. That is the same authority model the
 * Sustaining Recovery FRAAP uses for its report ids.
 */
@UseGuards(ApiKeyGuard)
@Controller('assessment/plan')
export class PlanController {
  constructor(
    private readonly plans: PlanService,
    private readonly pdf: PdfService,
  ) {}

  @Get(':id')
  async view(@Param('id', ParseUUIDPipe) id: string) {
    const plan = await this.plans.view(id);
    return { success: true, ...plan };
  }

  @Get(':id/pdf')
  async pdf_(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { html, language } = await this.plans.html(id);

    let file: Buffer;
    try {
      file = await this.pdf.render(html);
    } catch (err) {
      if (err instanceof PdfUnavailableError) {
        throw new ServiceUnavailableException(
          'PDF download is not available. Use your browser to print or save the plan instead.',
        );
      }
      throw err;
    }

    const filename =
      language === 'es' ? 'plan-de-accion-familiar.pdf' : 'family-action-plan.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file);
  }

  /**
   * Parent-requested deletion — immediate, per the approved retention policy.
   * Deletes the whole graph: answers, urgent note, generation records, and
   * every plan for the submission. Nothing remains that can be recovered,
   * which is what "delete my data" has to mean to be worth offering.
   */
  @Delete(':id')
  @HttpCode(200)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.plans.delete(id);
    return { success: true };
  }
}
