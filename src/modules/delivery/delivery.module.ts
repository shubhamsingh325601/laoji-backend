import { Module } from '@nestjs/common';
import { AllocationModule } from '../allocation/allocation.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationModule } from '../notification/notification.module';
import { RevenueModule } from '../revenue/revenue.module';
import { DeliveryService } from './delivery.service';
import { DeliveryPartnerController } from './delivery-partner.controller';
import { DeliveryOrderController } from './delivery-order.controller';
import { DeliveryEarningsController } from './delivery-earnings.controller';
import { AdminDeliveryController } from './admin-delivery.controller';

@Module({
  imports: [AllocationModule, PaymentModule, NotificationModule, RevenueModule],
  controllers: [DeliveryPartnerController, DeliveryOrderController, DeliveryEarningsController, AdminDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
