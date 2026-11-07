import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { VendorDiscountsModule } from '../vendor-discounts/vendor-discounts.module';
import { RevenueModule } from '../revenue/revenue.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CatalogService } from './catalog.service';
import { AdminCatalogController } from './admin-catalog.controller';
import { VendorCatalogController } from './vendor-catalog.controller';
import { VendorMenuController } from './vendor-menu.controller';
import { PublicCatalogController } from './public-catalog.controller';
import { VendorScheduleService } from './vendor-schedule.service';
import { GrocerySizesService } from './grocery-sizes.service';
import { BusinessTypesService } from './business-types.service';

@Module({
  imports: [NotificationModule, VendorDiscountsModule, RevenueModule, UploadsModule],
  controllers: [AdminCatalogController, VendorCatalogController, VendorMenuController, PublicCatalogController],
  providers: [CatalogService, VendorScheduleService, GrocerySizesService, BusinessTypesService],
  exports: [CatalogService, BusinessTypesService],
})
export class CatalogModule {}
