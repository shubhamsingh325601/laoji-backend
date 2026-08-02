import { Module } from '@nestjs/common';
import { AllocationModule } from '../allocation/allocation.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { OrderService } from './order.service';
import { CustomerOrderController } from './customer-order.controller';
import { VendorOrderController } from './vendor-order.controller';
import { AdminOrderController } from './admin-order.controller';

@Module({
  imports: [AllocationModule, CatalogModule, DeliveryModule],
  controllers: [CustomerOrderController, VendorOrderController, AdminOrderController],
  providers: [OrderService],
})
export class OrderModule {}
