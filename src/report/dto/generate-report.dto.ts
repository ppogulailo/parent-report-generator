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

const ERROR_MESSAGE =
  'responses must be an array of 24 integers between 1 and 4';
const LANGUAGE_ERROR = 'language must be "en" or "es"';
const CRISIS_ERROR = 'crisis must be a string of at most 1500 characters';

// Raised 500 → 1500 (founder testing, 2026-07-03): Spanish needs meaningfully
// more characters than English to describe the same emergency, and testers hit
// the old cap sooner than expected on Critical scenarios. Still a "brief note".
export const CRISIS_MAX_LENGTH = 1500;

export type Language = 'en' | 'es';

export class GenerateReportDto {
  @ApiProperty({
    description:
      'Answers to the 24 questions in order, each an integer from 1 (strong / healthy) to 4 (concerning).',
    type: [Number],
    minItems: 24,
    maxItems: 24,
    minimum: 1,
    maximum: 4,
    example: [
      4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3,
    ],
  })
  @IsArray({ message: ERROR_MESSAGE })
  @ArrayMinSize(24, { message: ERROR_MESSAGE })
  @ArrayMaxSize(24, { message: ERROR_MESSAGE })
  @IsInt({ each: true, message: ERROR_MESSAGE })
  @Min(1, { each: true, message: ERROR_MESSAGE })
  @Max(4, { each: true, message: ERROR_MESSAGE })
  responses!: number[];

  @ApiPropertyOptional({
    description:
      'Output language. "en" (default) generates the plan in English; "es" generates a natively Spanish plan.',
    enum: ['en', 'es'],
    default: 'en',
    example: 'en',
  })
  @IsOptional()
  @IsIn(['en', 'es'], { message: LANGUAGE_ERROR })
  language?: Language;

  @ApiPropertyOptional({
    description:
      'Optional free-text crisis field for urgent concerns (e.g., suspected fentanyl exposure, overdose history, suicidality, violence in the home). When any non-empty value is supplied, the report is generated at SERIOUS severity regardless of the 24 scores, and an URGENT CONCERN ACKNOWLEDGED section is added to the plan.',
    type: String,
    maxLength: CRISIS_MAX_LENGTH,
    example:
      'Found a pill press in the bedroom last week. Worried about fentanyl.',
  })
  @IsOptional()
  @IsString({ message: CRISIS_ERROR })
  @MaxLength(CRISIS_MAX_LENGTH, { message: CRISIS_ERROR })
  crisis?: string;
}
