import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CRISIS_MAX_LENGTH, type Language } from '../dto/generate-report.dto';

// DRAFT — the Sustaining Recovery questionnaire is 20 questions (see
// sr-questions.ts). Same 1–4 answer scale and optional language/crisis fields
// as the early-intervention DTO.
const SR_ERROR_MESSAGE =
  'responses must be an array of 20 integers between 1 and 4';
const LANGUAGE_ERROR = 'language must be "en" or "es"';
const CRISIS_ERROR = 'crisis must be a string of at most 1500 characters';

export class GenerateSustainingRecoveryDto {
  @ApiProperty({
    description:
      'Answers to the 20 Sustaining Recovery questions in order, each an integer from 1 (strongest / healthiest) to 4 (most concerning).',
    type: [Number],
    minItems: 20,
    maxItems: 20,
    minimum: 1,
    maximum: 4,
    example: [3, 4, 4, 3, 4, 3, 2, 3, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 4, 3],
  })
  @IsArray({ message: SR_ERROR_MESSAGE })
  @ArrayMinSize(20, { message: SR_ERROR_MESSAGE })
  @ArrayMaxSize(20, { message: SR_ERROR_MESSAGE })
  @IsInt({ each: true, message: SR_ERROR_MESSAGE })
  @Min(1, { each: true, message: SR_ERROR_MESSAGE })
  @Max(4, { each: true, message: SR_ERROR_MESSAGE })
  responses!: number[];

  @ApiPropertyOptional({
    description: 'Output language. "en" (default) or "es".',
    enum: ['en', 'es'],
    default: 'en',
    example: 'en',
  })
  @IsOptional()
  @IsIn(['en', 'es'], { message: LANGUAGE_ERROR })
  language?: Language;

  @ApiPropertyOptional({
    description:
      'Optional free-text crisis field (e.g., suspected relapse, overdose, or a safety crisis since returning home). When supplied, the plan is generated at HIGH RISK and an URGENT CONCERN ACKNOWLEDGED section is added.',
    type: String,
    maxLength: CRISIS_MAX_LENGTH,
    example:
      'Found an unknown substance in their room two days after coming home.',
  })
  @IsOptional()
  @IsString({ message: CRISIS_ERROR })
  @MaxLength(CRISIS_MAX_LENGTH, { message: CRISIS_ERROR })
  crisis?: string;
}
