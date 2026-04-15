import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportService } from './report.service';
import { GenerateReportResponse } from './interfaces/report.interface';

@ApiTags('report')
@ApiSecurity('api-key')
@Controller('report')
@UseGuards(ApiKeyGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a Parent Action Plan from 24 questionnaire responses',
    description:
      'Scores the 24 responses into 5 concern domains, selects the top 3 priorities, and asks OpenAI to generate a 5-section Parent Action Plan.',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan generated successfully.',
    schema: {
      example: {
        success: true,
        domainScores: {
          'Immediate Safety & Urgency': 3.6,
          'Household Structure': 2,
          'Boundary Consistency': 2.2,
          'Communication & Conflict': 3,
          'Support & Professional Engagement': 3,
        },
        topDomains: [
          'Immediate Safety & Urgency',
          'Communication & Conflict',
          'Support & Professional Engagement',
        ],
        report: {
          headlineSummary: 'string',
          keyPriorities: 'string',
          whatToAvoid: 'string',
          next7Days: 'string',
          encouragement: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (not an array of 24 integers between 1 and 4).',
    schema: {
      example: {
        success: false,
        error: 'responses must be an array of 24 integers between 1 and 4',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid X-API-Key header.',
    schema: {
      example: { success: false, error: 'Unauthorized' },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'OpenAI upstream call failed.',
    schema: {
      example: {
        success: false,
        error: 'Report generation failed. Please try again.',
      },
    },
  })
  generate(@Body() dto: GenerateReportDto): Promise<GenerateReportResponse> {
    return this.reportService.generate(dto);
  }
}
