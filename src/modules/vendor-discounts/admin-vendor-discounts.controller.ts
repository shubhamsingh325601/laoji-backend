import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VendorDiscountsService } from './vendor-discounts.service';
import { CreateVendorDiscountDto } from './dto/create-vendor-discount.dto';
import { UpdateVendorDiscountDto } from './dto/update-vendor-discount.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/vendors/:vendorId/discounts')
export class AdminVendorDiscountsController {
  constructor(private readonly discountsService: VendorDiscountsService) {}

  @Get()
  listForVendor(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.discountsService.listByVendor(vendorId);
  }

  @Post()
  create(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() dto: CreateVendorDiscountDto,
  ) {
    return this.discountsService.create(vendorId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDiscountDto,
  ) {
    return this.discountsService.update(id, dto);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.discountsService.toggleActive(id);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.discountsService.delete(id);
  }
}
