import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../config/database.module';
import { CouponService } from './coupon.service';
import { AdminCouponController } from './admin-coupon.controller';
import { PublicCouponController } from './public-coupon.controller';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AdminCouponController, PublicCouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
