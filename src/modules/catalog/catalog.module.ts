import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { AdminCatalogController } from './admin-catalog.controller';
import { VendorCatalogController } from './vendor-catalog.controller';
import { VendorMenuController } from './vendor-menu.controller';
import { PublicCatalogController } from './public-catalog.controller';

@Module({
  controllers: [AdminCatalogController, VendorCatalogController, VendorMenuController, PublicCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
