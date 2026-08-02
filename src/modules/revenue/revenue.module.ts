import { Module } from '@nestjs/common';
import { RevenueConfigService } from './revenue-config.service';
import { SettlementService } from './settlement.service';
import { AdminRevenueController } from './admin-revenue.controller';
import { VendorSettlementController } from './vendor-settlement.controller';
import { PartnerSettlementController } from './partner-settlement.controller';

@Module({
  controllers: [AdminRevenueController, VendorSettlementController, PartnerSettlementController],
  providers: [RevenueConfigService, SettlementService],
  exports: [RevenueConfigService, SettlementService],
})
export class RevenueModule {}
