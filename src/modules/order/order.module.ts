import { Module } from '@nestjs/common';
import { AllocationModule } from '../allocation/allocation.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';
import { RevenueModule } from '../revenue/revenue.module';
import { OrderService } from './order.service';
import { CustomerOrderController } from './customer-order.controller';
import { VendorOrderController } from './vendor-order.controller';
import { AdminOrderController } from './admin-order.controller';

@Module({
  imports: [AllocationModule, CatalogModule, DeliveryModule, PaymentModule, NotificationModule, RevenueModule],
  controllers: [CustomerOrderController, VendorOrderController, AdminOrderController],
  providers: [OrderService],
})
export class OrderModule {}
