import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { ResponseCacheService } from './response-cache.service';

// Everything that changes cached data (catalog, menus, vendor open/closed,
// banners, coupons, revenue config) is written through admin or vendor
// routes — plus DELETE /users/me, which closes a vendor's store — so a
// successful write there clears the whole response cache. Customers
// therefore see edits immediately instead of after the TTL.
const INVALIDATING_PATH = /^\/api\/v1\/(admin|vendor|vendors|users\/me)(\/|$)/;

@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cache: ResponseCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || req.method === 'HEAD' || !INVALIDATING_PATH.test(req.path)) {
      return next.handle();
    }
    return next.handle().pipe(tap(() => this.cache.clear()));
  }
}
