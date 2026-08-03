import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { DeliveryService } from './delivery.service';
import { SetOnlineDto, UpdateLocationDto, UpsertDeliveryPartnerDto } from './dto/delivery-partner.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
@Controller('delivery-partners')
export class DeliveryPartnerController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('me')
  upsertProfile(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpsertDeliveryPartnerDto) {
    return this.delivery.upsertProfile(user.sub, dto.vehicleType);
  }

  @Get('me')
  myProfile(@CurrentUser() user: JwtAccessPayload) {
    return this.delivery.getEnrichedProfile(user.sub);
  }

  @Patch('me/online')
  setOnline(@CurrentUser() user: JwtAccessPayload, @Body() dto: SetOnlineDto) {
    return this.delivery.setOnline(user.sub, dto.isOnline);
  }

  @Patch('me/location')
  updateLocation(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateLocationDto) {
    return this.delivery.updateLocation(user.sub, dto.lat, dto.lng);
  }
}
