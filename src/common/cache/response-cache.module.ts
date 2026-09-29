import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheInvalidationInterceptor } from './cache-invalidation.interceptor';
import { ResponseCacheInterceptor } from './response-cache.interceptor';
import { ResponseCacheService } from './response-cache.service';

@Global()
@Module({
  providers: [
    ResponseCacheService,
    ResponseCacheInterceptor,
    { provide: APP_INTERCEPTOR, useClass: CacheInvalidationInterceptor },
  ],
  exports: [ResponseCacheService, ResponseCacheInterceptor],
})
export class ResponseCacheModule {}
