import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, of, tap } from 'rxjs';
import { ResponseCacheService } from './response-cache.service';

// Caches GET responses by full URL (path + query) for RESPONSE_CACHE_TTL_MS.
// Apply with @UseInterceptors(ResponseCacheInterceptor) on public controllers
// only — never on anything whose response depends on the caller.
@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: ResponseCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (req.method !== 'GET') return next.handle();

    const res = http.getResponse<Response>();
    const key = req.originalUrl;
    const cached = this.cache.get(key);
    if (cached.hit) {
      res.setHeader('X-Cache', 'HIT');
      return of(cached.value);
    }

    res.setHeader('X-Cache', 'MISS');
    return next.handle().pipe(tap((value) => this.cache.set(key, value)));
  }
}
