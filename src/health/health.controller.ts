import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe (no auth required)' })
  @ApiResponse({
    status: 200,
    schema: { example: { status: 'ok' } },
  })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
