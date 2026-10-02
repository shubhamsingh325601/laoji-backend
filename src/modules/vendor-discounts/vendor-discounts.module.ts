import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../config/database.module';
import { VendorDiscountsService } from './vendor-discounts.service';
import { AdminVendorDiscountsController } from './admin-vendor-discounts.controller';
import { PublicVendorDiscountsController } from './public-vendor-discounts.controller';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AdminVendorDiscountsController, PublicVendorDiscountsController],
  providers: [VendorDiscountsService],
  exports: [VendorDiscountsService],
})
export class VendorDiscountsModule {}
