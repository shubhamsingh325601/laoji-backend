import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { JwtAccessPayload } from '../auth/auth.types';
import { AuditService } from './audit.service';
import {
  ADMIN_LOGIN_ROUTE,
  describeRoute,
  isAuditedMethod,
  isIgnoredRoute,
  normalizeRoute,
  sanitizeBody,
  targetFromParams,
} from './audit-describe';

/**
 * Records every write an admin makes (POST / PUT / PATCH / DELETE with an admin
 * token), whether it worked or failed, plus admin sign-ins. Reads are not
 * recorded. Runs after the guards, so req.user is the verified admin.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: JwtAccessPayload }>();
    const res = http.getResponse<Response>();
    if (!isAuditedMethod(req.method)) return next.handle();

    const route = normalizeRoute(req.route?.path ?? req.path);
    const isLogin = route === ADMIN_LOGIN_ROUTE;
    const admin = req.user?.role === 'admin' ? req.user : undefined;
    if (!isLogin && (!admin || isIgnoredRoute(route))) return next.handle();

    const startedAt = Date.now();
    const base = {
      method: req.method,
      route,
      path: (req.originalUrl || req.url || route).split('?')[0],
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    };

    if (isLogin) {
      const typed = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
      return next.handle().pipe(
        tap({
          next: (data: { userId?: string } | undefined) =>
            this.audit.record({
              ...base,
              eventType: 'login',
              adminId: data?.userId ?? null,
              adminEmail: typed,
              resource: 'auth',
              action: 'sign in',
              outcome: 'success',
              statusCode: res.statusCode,
              durationMs: Date.now() - startedAt,
            }),
          error: (err) =>
            this.audit.record({
              ...base,
              eventType: 'login_failed',
              adminEmail: typed,
              resource: 'auth',
              action: 'sign in',
              outcome: 'failed',
              statusCode: statusOf(err),
              errorMessage: messageOf(err),
              durationMs: Date.now() - startedAt,
            }),
        }),
      );
    }

    const { resource, action } = describeRoute(req.method, route);
    const entry = {
      ...base,
      eventType: 'action' as const,
      adminId: admin!.sub,
      resource,
      action,
      targetId: targetFromParams(req.params),
      params: Object.keys(req.params ?? {}).length ? req.params : null,
      body: sanitizeBody(req.body),
    };
    return next.handle().pipe(
      tap({
        next: () =>
          this.audit.record({
            ...entry,
            outcome: 'success',
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
          }),
        error: (err) =>
          this.audit.record({
            ...entry,
            outcome: 'failed',
            statusCode: statusOf(err),
            errorMessage: messageOf(err),
            durationMs: Date.now() - startedAt,
          }),
      }),
    );
  }
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.ip || null;
}

function statusOf(err: unknown): number {
  return err instanceof HttpException ? err.getStatus() : 500;
}

function messageOf(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    const msg = typeof body === 'string' ? body : (body as { message?: string | string[] })?.message;
    return Array.isArray(msg) ? msg.join('; ') : (msg ?? err.message);
  }
  return err instanceof Error ? err.message : String(err);
}
