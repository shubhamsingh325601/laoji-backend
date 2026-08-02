import { Module } from '@nestjs/common';
import { AllocationModule } from '../allocation/allocation.module';
import { DeliveryService } from './delivery.service';
import { DeliveryPartnerController } from './delivery-partner.controller';
import { DeliveryOrderController } from './delivery-order.controller';
import { AdminDeliveryController } from './admin-delivery.controller';

@Module({
  imports: [AllocationModule],
  controllers: [DeliveryPartnerController, DeliveryOrderController, AdminDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
