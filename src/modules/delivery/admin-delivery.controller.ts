import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeliveryService } from './delivery.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/delivery-partners')
export class AdminDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  list() {
    return this.delivery.listPartnersBasic();
  }
}
