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
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      console.error('[HttpExceptionFilter] Unhandled exception:', exception);
    }

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let body =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    // Handle database constraint violations gracefully instead of 500
    if (!(exception instanceof HttpException) && typeof exception === 'object' && exception !== null) {
      const anyErr = exception as any;
      const code = anyErr.code ?? anyErr.cause?.code;
      const detail = anyErr.detail ?? anyErr.cause?.detail;

      if (code === '23503') {
        status = HttpStatus.CONFLICT;
        body = {
          error: 'Conflict',
          message: detail || 'Cannot complete operation: this record is referenced by other items.',
        };
      } else if (code === '23505') {
        status = HttpStatus.CONFLICT;
        body = {
          error: 'Conflict',
          message: detail || 'A record with this unique information already exists.',
        };
      }
    }

    const { code, message, details } = normalize(status, body);

    response.status(status).json({ error: { code, message, details } });
  }
}

function normalize(
  status: number,
  body: unknown,
): { code: string; message: string; details: Record<string, unknown> } {
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    const message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? 'Error');
    const code = typeof b.error === 'string' ? toCode(b.error) : toCode(String(status));
    return { code, message: String(message), details: {} };
  }
  if (typeof body === 'string') {
    return { code: toCode(String(status)), message: body, details: {} };
  }
  return { code: toCode(String(status)), message: 'Internal server error', details: {} };
}

function toCode(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
