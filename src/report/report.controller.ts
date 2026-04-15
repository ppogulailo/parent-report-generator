import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportService } from './report.service';
import { GenerateReportResponse } from './interfaces/report.interface';

@Controller('report')
@UseGuards(ApiKeyGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateReportDto): Promise<GenerateReportResponse> {
    return this.reportService.generate(dto);
  }
}