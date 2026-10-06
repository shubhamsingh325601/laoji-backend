import { Module } from '@nestjs/common';
import { RevenueConfigService } from './revenue-config.service';
import { SettlementService } from './settlement.service';
import { RiderPayoutService } from './rider-payout.service';
import { VendorWithdrawalService } from './vendor-withdrawal.service';
import { AdminRevenueController } from './admin-revenue.controller';
import { AdminWithdrawalController } from './admin-withdrawal.controller';
import { VendorSettlementController } from './vendor-settlement.controller';
import { PartnerSettlementController } from './partner-settlement.controller';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [WalletModule, NotificationModule],
  controllers: [
    AdminRevenueController,
    AdminWithdrawalController,
    VendorSettlementController,
    PartnerSettlementController,
  ],
  providers: [RevenueConfigService, SettlementService, VendorWithdrawalService, RiderPayoutService],
  exports: [RevenueConfigService, SettlementService, RiderPayoutService],
})
export class RevenueModule {}
