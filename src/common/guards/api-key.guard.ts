import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];
    const expected = process.env.API_SECRET_KEY;

    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}