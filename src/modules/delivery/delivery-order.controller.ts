import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { DeliveryService } from './delivery.service';
import { AdvanceDeliveryStatusDto, VerifyDeliveryDto } from './dto/delivery-order.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
@Controller('delivery/orders')
export class DeliveryOrderController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('incoming')
  incoming(@CurrentUser() user: JwtAccessPayload) {
    return this.delivery.listIncoming(user.sub);
  }

  @Get('active')
  active(@CurrentUser() user: JwtAccessPayload) {
    return this.delivery.listActive(user.sub);
  }

  @Get(':type/:id')
  detail(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.delivery.getOrderDetailForPartner(user.sub, type, id);
  }

  @Post(':type/:id/accept')
  accept(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.delivery.accept(user.sub, type, id);
  }

  @Post(':type/:id/reject')
  reject(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.delivery.reject(user.sub, type, id);
  }

  @Patch(':type/:id/advance')
  advance(
    @CurrentUser() user: JwtAccessPayload,
    @Param('type') type: 'grocery' | 'food',
    @Param('id') id: string,
    @Body() dto: AdvanceDeliveryStatusDto,
  ) {
    return this.delivery.advance(user.sub, type, id, dto.status);
  }

  @Throttle({ deliveryOtpVerify: { limit: 10, ttl: 60_000 } })
  @Post(':type/:id/verify-delivery')
  verifyDelivery(
    @CurrentUser() user: JwtAccessPayload,
    @Param('type') type: 'grocery' | 'food',
    @Param('id') id: string,
    @Body() dto: VerifyDeliveryDto,
  ) {
    return this.delivery.verifyDelivery(user.sub, type, id, dto.otp);
  }
}
