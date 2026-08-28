import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeliveryService } from './delivery.service';
import { CreateAdminDeliveryPartnerDto, UpdateAdminDeliveryPartnerDto } from './dto/admin-delivery.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/delivery-partners')
export class AdminDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  list() {
    return this.delivery.listPartnersAdmin();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.delivery.getAdminPartner(id);
  }

  @Post()
  create(@Body() dto: CreateAdminDeliveryPartnerDto) {
    return this.delivery.createAdminPartner(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdminDeliveryPartnerDto) {
    return this.delivery.updateAdminPartner(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.delivery.deleteAdminPartner(id);
  }
}
