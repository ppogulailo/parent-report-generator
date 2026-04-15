import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const ERROR_MESSAGE =
  'responses must be an array of 24 integers between 1 and 4';

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
}
