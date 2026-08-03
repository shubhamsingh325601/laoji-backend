import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { DeliveryService } from './delivery.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
@Controller('delivery')
export class DeliveryEarningsController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('history')
  history(@CurrentUser() user: JwtAccessPayload) {
    return this.delivery.getHistoryForPartner(user.sub);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: JwtAccessPayload) {
    return this.delivery.getEarningsForPartner(user.sub);
  }
}
