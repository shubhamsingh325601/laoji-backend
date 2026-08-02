import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './config/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { PaymentModule } from './modules/payment/payment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RevenueModule } from './modules/revenue/revenue.module';
import { OrderModule } from './modules/order/order.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 100 },
        // Named separately from 'default' (Phase 5 fix) — otp/request,
        // otp/verify and admin/login all reused the 'default' throttler
        // name with different per-route limits via @Throttle, but
        // @nestjs/throttler's storage keys records by throttler name + IP,
        // not by route, so all three were silently sharing one counter and
        // otp/request's tight 3/60s limit tripped from hits against the
        // other two routes entirely.
        { name: 'otpRequest', ttl: 60_000, limit: 3 },
        { name: 'otpVerify', ttl: 60_000, limit: 10 },
        { name: 'adminLogin', ttl: 60_000, limit: 10 },
      ],
    }),
    HealthModule,
    AuthModule,
    UserModule,
    UploadsModule,
    CatalogModule,
    AllocationModule,
    DeliveryModule,
    PaymentModule,
    NotificationModule,
    RevenueModule,
    OrderModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
