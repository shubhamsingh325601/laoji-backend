import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ResponseCacheService } from './response-cache.service';
export declare class CacheInvalidationInterceptor implements NestInterceptor {
    private readonly cache;
    constructor(cache: ResponseCacheService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
