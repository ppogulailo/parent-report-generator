import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ContentService } from '../content/content.service';
import { GenerationService } from '../generation/generation.service';
import { PdfService } from '../render/pdf.service';
import { SelectionService } from '../selection/selection.service';
import { AssessmentValidator } from './assessment.validator';
import { PlanService } from './plan.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

/**
 * The Version 1.0 endpoints.
 *
 * The pre-existing `/api/report/generate` is left in place and untouched, so the
 * live site keeps working while the frontend migrates. It should be removed once
 * the frontend is on this path — two routes generating plans by two different
 * methodologies is exactly the kind of thing that survives a launch and then
 * quietly serves half the traffic.
 */
@Controller('assessment')
export class AssessmentController {
  constructor(
    private readonly content: ContentService,
    private readonly validator: AssessmentValidator,
    private readonly selection: SelectionService,
    private readonly generation: GenerationService,
    private readonly plans: PlanService,
    private readonly pdf: PdfService,
  ) {}

  /**
   * What the questionnaire is, so the frontend renders it from content rather
   * than from its own hard-coded copy. Two lists of 24 questions that have to be
   * kept in step by hand is one list too many.
   */
  @Get('questionnaire')
  questionnaire() {
    const { assessment } = this.content;
    return {
      success: true,
      version: assessment.version,
      status: assessment.status,
      title: assessment.title,
      intro: assessment.intro,
      scale: assessment.scale,
      // The domains, with the questions each one owns, so the questionnaire can
      // render grouped exactly as the existing one does. The old frontend keeps
      // its own copy of this map; reading it from content is what stops the two
      // drifting.
      domains: assessment.domains.map((d) => ({
        id: d.id,
        order: d.order,
        label: d.label,
        description: d.description,
        questionIds: d.questionIds,
      })),
      questions: assessment.questions.map((q) => ({
        id: q.id,
        order: q.order,
        prompt: q.prompt,
        options: q.options,
      })),
      gates: assessment.gates.map((g) => ({
        id: g.id,
        order: g.order,
        prompt: g.prompt,
        help: g.help,
        options: g.options,
      })),
      urgentField: assessment.urgentField,
    };
  }

  /**
   * Whether the content is approved yet, and what version is governing.
   *
   * The landing page reads this at runtime to show or hide the draft notice, so
   * marking the methodology approved does not need a frontend deploy.
   */
  @Get('capabilities')
  capabilities() {
    const { assessment, matrix } = this.content;
    const draft =
      assessment.status !== 'approved' || matrix.status !== 'approved';
    return {
      success: true,
      draft,
      assessmentVersion: assessment.version,
      matrixVersion: matrix.version,
      methodologyVersion: matrix.methodologyVersion,
      workshopLinksAvailable: this.content.workshops.workshops.some(
        (w) => w.url !== null,
      ),
      // Whether the API can hand back a PDF. The frontend shows the download
      // button only when this is true; the print path always exists.
      pdf: this.pdf.available,
    };
  }

  /**
   * The same pipeline, streamed as server-sent events.
   *
   * A plan takes tens of seconds to write, and none of the matrix's decision
   * does — so the scores, the severity and the plan's outline go out
   * immediately, and the sections follow as they are written. A parent reaches
   * their results screen at once instead of watching a spinner.
   *
   * Uses the raw response rather than a Nest interceptor because the stream has
   * to flush per event; anything that buffers defeats the point.
   */
  @Post('stream')
  @UseGuards(ApiKeyGuard)
  async stream(
    @Body() dto: SubmitAssessmentDto,
    @Res() res: Response,
  ): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Fly's proxy and any nginx in front of it will otherwise buffer the
      // whole response and deliver it at once.
      'X-Accel-Buffering': 'no',
    });

    const send = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let planId: string | undefined;
    try {
      const submission = this.validator.validate(dto);
      const selection = this.selection.select(
        submission.responses,
        submission.urgentConcern,
        submission.gateAnswers,
      );

      // Fail-soft: a family whose plan cannot be saved still receives it —
      // they just are not offered a return link.
      const persisted = await this.plans.persistStart({
        responses: submission.responses,
        urgentText: submission.urgentConcern,
        language: submission.language,
        selection,
      });
      planId = persisted?.planId;

      for await (const event of this.generation.generateStream(
        selection,
        submission.language,
        submission.urgentConcern,
        this.plans.exchangeListener(planId),
      )) {
        if (event.type === 'report') {
          if (planId) {
            await this.plans.persistComplete(planId, event.report);
          }
          send('report', {
            success: true,
            planId: planId ?? null,
            severity: {
              tierId: selection.tierId,
              label: event.report.tierLabel,
              description: this.content.tier(selection.tierId).description[
                submission.language
              ],
            },
            report: {
              sections: event.report.sections,
              language: event.report.language,
            },
            audit: selection.audit,
          });
        } else if (event.type === 'decided') {
          // The return link exists before a word of the plan does.
          send('decided', { ...event, planId: planId ?? null });
        } else {
          send(event.type, event);
        }
      }
    } catch (err) {
      if (planId) await this.plans.persistFailure(planId, 'generation-failed');
      // The stream is already open, so a failure cannot be an HTTP status. It
      // goes out as an event instead.
      //
      // A validation error is the parent's to see — it names which question is
      // missing. Anything else is deliberately opaque: it can quote the model's
      // output back, which contains what the family submitted.
      const isValidation =
        err instanceof BadRequestException ||
        (err instanceof Error && err.name === 'BadRequestException');
      send('failed', {
        success: false,
        error: isValidation
          ? (err as BadRequestException).message
          : 'Report generation failed. Please try again.',
      });
    } finally {
      res.end();
    }
  }

  @Post('submit')
  @UseGuards(ApiKeyGuard)
  async submit(@Body() dto: SubmitAssessmentDto) {
    const submission = this.validator.validate(dto);

    const selection = this.selection.select(
      submission.responses,
      submission.urgentConcern,
      submission.gateAnswers,
    );

    const persisted = await this.plans.persistStart({
      responses: submission.responses,
      urgentText: submission.urgentConcern,
      language: submission.language,
      selection,
    });

    let report;
    try {
      report = await this.generation.generate(
        selection,
        submission.language,
        submission.urgentConcern,
        this.plans.exchangeListener(persisted?.planId),
      );
    } catch (err) {
      if (persisted) {
        await this.plans.persistFailure(persisted.planId, 'generation-failed');
      }
      throw err;
    }

    if (persisted) {
      await this.plans.persistComplete(persisted.planId, report);
    }

    return {
      success: true,
      planId: persisted?.planId ?? null,
      // The client-facing domain labels, not the internal ids — this is the
      // response shape the existing frontend already understands.
      domainScores: Object.fromEntries(
        Object.entries(selection.scored.domainScores).map(([id, score]) => [
          this.content.domainLabel(id, submission.language),
          score,
        ]),
      ),
      topDomains: selection.scored.topDomains.map((id) =>
        this.content.domainLabel(id, submission.language),
      ),
      severity: {
        tierId: selection.tierId,
        label: report.tierLabel,
        description: this.content.tier(selection.tierId).description[
          submission.language
        ],
      },
      report: {
        sections: report.sections,
        language: report.language,
      },
      /** How the decision was made, so "why did this family get this?" stays
       *  answerable without re-running anything. */
      audit: selection.audit,
    };
  }
}
