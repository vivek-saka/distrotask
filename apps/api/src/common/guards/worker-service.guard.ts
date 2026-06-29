import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Workers are a separate trusted service, not an end-user — they authenticate
 * via a shared secret header (WORKER_SERVICE_TOKEN) rather than a user JWT.
 * This guard is applied only to the small set of internal callback routes
 * (status updates, log appends, heartbeats) that the worker service calls.
 */
@Injectable()
export class WorkerServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-worker-token'];
    const expected = this.configService.get<string>('app.workerServiceToken');

    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid or missing worker service token');
    }

    return true;
  }
}
