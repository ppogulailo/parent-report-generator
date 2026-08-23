import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * The request shape. Deliberately thin: `class-validator` checks that this is
 * the right *kind* of thing, and `AssessmentValidator` checks it against the
 * actual questionnaire in `content/`. Splitting them means the questionnaire can
 * change without touching a decorator.
 */
export class SubmitAssessmentDto {
  /**
   * Answers keyed by question id — `{ "q01": 3, ... }`.
   *
   * Keyed, not positional. The live endpoint takes an array, which silently
   * re-maps every stored answer onto a different question the moment the
   * questionnaire is reordered.
   */
  @IsObject()
  responses!: Record<string, number>;

  @IsOptional()
  @IsIn(['en', 'es'])
  language?: 'en' | 'es';

  /** The optional urgent-concern field. Length is enforced against
   *  `assessment.json` too; this is the outer bound. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  urgentConcern?: string;

  /** Answers to the non-scored gating questions, keyed by gate id. */
  @IsOptional()
  @IsObject()
  gates?: Record<string, string>;
}
