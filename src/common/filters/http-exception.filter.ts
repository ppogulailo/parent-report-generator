import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'string') {
        error = raw;
      } else if (raw && typeof raw === 'object') {
        const message = (raw as { message?: unknown }).message;
        if (Array.isArray(message) && message.length > 0) {
          error = String(message[0]);
        } else if (typeof message === 'string') {
          error = message;
        } else {
          const fallback = (raw as { error?: unknown }).error;
          if (typeof fallback === 'string') error = fallback;
        }
      }
    }

    response.status(status).json({ success: false, error });
  }
}
