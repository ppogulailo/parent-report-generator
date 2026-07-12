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
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { GenerateSustainingRecoveryDto } from './sr-generate-report.dto';
import {
  GenerateSustainingRecoveryResponse,
  SustainingRecoveryService,
} from './sustaining-recovery.service';

// DRAFT scaffold — the Sustaining Recovery Parent Action Plan. Mirrors the
// early-intervention report controller (POST /api/report/generate[/stream])
// but for the post-treatment plan. Content is draft pending founder review.
@ApiTags('report')
@ApiSecurity('api-key')
@Controller('report/sustaining-recovery')
@UseGuards(ApiKeyGuard)
export class SustainingRecoveryController {
  constructor(private readonly service: SustainingRecoveryService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generate a Sustaining Recovery Parent Action Plan from 20 questionnaire responses (DRAFT scaffold)',
    description:
      'Scores the 20 post-treatment responses into 5 recovery concern domains, selects the top 3 priorities, and generates a 7-section Sustaining Recovery plan for a child who has returned home from treatment.',
  })
  generate(
    @Body() dto: GenerateSustainingRecoveryDto,
  ): Promise<GenerateSustainingRecoveryResponse> {
    return this.service.generate(dto);
  }

  @Post('generate/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Stream a Sustaining Recovery Parent Action Plan (SSE, DRAFT scaffold)',
  })
  async generateStream(
    @Body() dto: GenerateSustainingRecoveryDto,
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
      for await (const chunk of this.service.generateStream(dto)) {
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
