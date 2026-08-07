import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';

// Exempted from the global throttler on purpose: Render probes this path as
// its health check, and the ThrottlerGuard (APP_GUARD) counts every request
// against EVERY configured throttler bucket, not just 'default'. The named
// buckets are tight (otpRequest is 3/min), so Render's own health probes
// tripped them within a few checks, /api/v1/health returned 429, Render
// marked the instance unhealthy and killed it — a crash loop that surfaced
// as intermittent 404/502/cold-start behavior. A health endpoint that can
// 429 a platform probe defeats the point of a health check. The no-arg
// @SkipThrottle() form only skips the 'default' bucket, so each named
// throttler must be listed explicitly.
@SkipThrottle({
  default: true,
  otpRequest: true,
  otpVerify: true,
  adminLogin: true,
  orderCreate: true,
  paymentInitiate: true,
  productSuggestion: true,
  supportContact: true,
})
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'connected' };
  }
}
