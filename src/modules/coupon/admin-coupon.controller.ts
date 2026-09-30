import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/coupons')
export class AdminCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  listAll() {
    return this.couponService.listAllForAdmin();
  }

  @Get('vendor/:vendorId')
  listByVendor(@Param('vendorId') vendorId: string) {
    return this.couponService.listActive(vendorId);
  }

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.couponService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.delete(id);
  }
}
