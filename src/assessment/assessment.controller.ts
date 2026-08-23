import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ContentService } from '../content/content.service';
import { GenerationService } from '../generation/generation.service';
import { SelectionService } from '../selection/selection.service';
import { AssessmentValidator } from './assessment.validator';
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
    };
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

    const report = await this.generation.generate(
      selection,
      submission.language,
      submission.urgentConcern,
    );

    return {
      success: true,
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
