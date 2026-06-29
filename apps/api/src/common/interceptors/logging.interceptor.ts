import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') ?? '';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(
          `${method} ${originalUrl} ${response.statusCode} ${duration}ms - ${ip} "${userAgent}"`,
        );
      }),
      catchError((err) => {
        const duration = Date.now() - start;
        this.logger.warn(`${method} ${originalUrl} FAILED ${duration}ms - ${err?.message ?? 'unknown error'}`);
        throw err;
      }),
    );
  }
}
