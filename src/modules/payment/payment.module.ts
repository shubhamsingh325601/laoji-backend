import { Module } from '@nestjs/common';
import { RevenueModule } from '../revenue/revenue.module';
import { PaymentService } from './payment.service';
import { UpiDeepLinkProvider } from './providers/upi-deeplink.provider';
import { CodProvider } from './providers/cod.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { CustomerPaymentController } from './customer-payment.controller';
import { AdminPaymentController } from './admin-payment.controller';

@Module({
  imports: [RevenueModule],
  controllers: [CustomerPaymentController, AdminPaymentController],
  providers: [PaymentService, UpiDeepLinkProvider, CodProvider, RazorpayProvider],
  exports: [PaymentService],
})
export class PaymentModule {}
