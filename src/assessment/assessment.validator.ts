import { BadRequestException, Injectable } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import type { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import type { GateAnswers, Responses } from '../selection/selection.types';

/**
 * Validates a submission against the questionnaire actually in `content/`.
 *
 * Separate from the DTO on purpose. The DTO says "responses is an object";
 * this says "it answers exactly these 24 questions, each within the scale" —
 * which is a content question, and content changes without a redeploy.
 *
 * Incomplete submissions are rejected rather than filled in. The scoring service
 * *can* fill a missing answer with the midpoint, but that is a safety net for a
 * question added mid-session, not a licence to score a half-finished
 * questionnaire and hand someone a plan built on assumptions.
 */
export interface ValidatedSubmission {
  responses: Responses;
  gateAnswers: GateAnswers;
  urgentConcern?: string;
  language: 'en' | 'es';
}

@Injectable()
export class AssessmentValidator {
  constructor(private readonly content: ContentService) {}

  validate(dto: SubmitAssessmentDto): ValidatedSubmission {
    const { assessment } = this.content;
    const { min, max } = assessment.scale;
    const problems: string[] = [];

    const known = new Set(assessment.questions.map((q) => q.id));
    const responses: Responses = {};

    for (const [id, value] of Object.entries(dto.responses ?? {})) {
      if (!known.has(id)) {
        problems.push(`unknown question "${id}"`);
        continue;
      }
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        problems.push(`"${id}" must be a whole number`);
        continue;
      }
      if (value < min || value > max) {
        problems.push(`"${id}" must be between ${min} and ${max}`);
        continue;
      }
      responses[id] = value;
    }

    const missing = assessment.questions
      .map((q) => q.id)
      .filter((id) => responses[id] === undefined);
    if (missing.length > 0) {
      problems.push(
        `${missing.length} question(s) not answered: ${missing.join(', ')}`,
      );
    }

    const gateAnswers: GateAnswers = {};
    for (const [id, value] of Object.entries(dto.gates ?? {})) {
      const gate = assessment.gates.find((g) => g.id === id);
      if (!gate) {
        problems.push(`unknown question "${id}"`);
        continue;
      }
      if (!gate.options.some((option) => option.value === value)) {
        problems.push(`"${id}" is not one of the available answers`);
        continue;
      }
      gateAnswers[id] = value;
    }

    const urgent = dto.urgentConcern?.trim();
    if (urgent && urgent.length > assessment.urgentField.maxLength) {
      problems.push(
        `the urgent field is limited to ${assessment.urgentField.maxLength} characters`,
      );
    }

    if (problems.length > 0) {
      // Shape problems only. Nothing the parent wrote is echoed back — it goes
      // into logs and, through the exception filter, a browser.
      throw new BadRequestException(
        `Invalid submission: ${problems.join('; ')}`,
      );
    }

    return {
      responses,
      gateAnswers,
      urgentConcern: urgent && urgent.length > 0 ? urgent : undefined,
      language: dto.language ?? 'en',
    };
  }
}
