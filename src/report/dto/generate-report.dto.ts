import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';

const ERROR_MESSAGE =
  'responses must be an array of 24 integers between 1 and 4';

export class GenerateReportDto {
  @IsArray({ message: ERROR_MESSAGE })
  @ArrayMinSize(24, { message: ERROR_MESSAGE })
  @ArrayMaxSize(24, { message: ERROR_MESSAGE })
  @IsInt({ each: true, message: ERROR_MESSAGE })
  @Min(1, { each: true, message: ERROR_MESSAGE })
  @Max(4, { each: true, message: ERROR_MESSAGE })
  responses!: number[];
}