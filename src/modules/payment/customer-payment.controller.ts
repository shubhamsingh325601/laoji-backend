import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
@Controller('payments')
export class CustomerPaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Throttle({ paymentInitiate: { limit: 10, ttl: 60_000 } })
  @Post(':type/:orderId/initiate')
  initiate(
    @CurrentUser() user: JwtAccessPayload,
    @Param('type') type: 'grocery' | 'food',
    @Param('orderId') orderId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.payments.initiate(type, orderId, user.sub, dto.method);
  }

  @Get(':type/:orderId')
  get(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('orderId') orderId: string) {
    return this.payments.getForOrder(type, orderId, user.sub);
  }

  @Post(':type/:orderId/confirm')
  confirm(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('orderId') orderId: string) {
    return this.payments.confirmByCustomer(type, orderId, user.sub);
  }
}
