import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
          topImmediatePriorities: 'string',
          keyPriorities: 'string',
          whatToAvoid: 'string',
          first72Hours: 'string',
          days4to7: 'string',
          encouragement: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed (not an array of 24 integers between 1 and 4).',
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

  @Post('generate/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stream a Parent Action Plan (Server-Sent Events)',
    description:
      'Same input/scoring as /generate, but streams the plan back as SSE. Emits `event: scores` immediately, then `event: text` deltas as OpenAI produces tokens, then `event: done`. On failure emits `event: error` and ends.',
  })
  async generateStream(
    @Body() dto: GenerateReportDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const chunk of this.reportService.generateStream(dto)) {
        send(chunk.type, chunk);
      }
    } catch {
      send('error', {
        type: 'error',
        error: 'Report generation failed. Please try again.',
      });
    } finally {
      res.end();
    }
  }
}
