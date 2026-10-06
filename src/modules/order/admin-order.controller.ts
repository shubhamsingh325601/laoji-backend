import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { OrderService } from './order.service';
import { ChangeOrderVendorDto } from './dto/change-order-vendor.dto';
import { AdminCreateFoodOrderDto, AdminCreateGroceryOrderDto } from './dto/admin-create-order.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  listAll(@Query('includeUnpaid') includeUnpaid?: string) {
    return this.orders.listAllOrdersForAdmin({ includeUnpaid: includeUnpaid === 'true' });
  }

  // Declared before ':type/:id' so "customers" isn't read as an order type.
  @Get('customers/:customerId/addresses')
  customerAddresses(@Param('customerId') customerId: string) {
    return this.orders.listCustomerAddressesForAdmin(customerId);
  }

  @Post('grocery')
  createGrocery(@CurrentUser() user: JwtAccessPayload, @Body() dto: AdminCreateGroceryOrderDto) {
    const { customerId, paymentMethod, ...order } = dto;
    return this.orders.createOrderForCustomer(user.sub, 'grocery', customerId, order, paymentMethod);
  }

  @Post('food')
  createFood(@CurrentUser() user: JwtAccessPayload, @Body() dto: AdminCreateFoodOrderDto) {
    const { customerId, paymentMethod, ...order } = dto;
    return this.orders.createOrderForCustomer(user.sub, 'food', customerId, order, paymentMethod);
  }

  @Get(':type/:id')
  timeline(@Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.orders.getOrderTimelineForAdmin(type, id);
  }

  @Post(':type/:id/accept')
  accept(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.orders.acceptOrderByAdmin(user.sub, type, id);
  }

  @Post(':type/:id/cancel')
  cancel(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.orders.cancelOrder(user.sub, type, id);
  }

  @Post(':type/:id/restore')
  restore(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.orders.restoreOrder(user.sub, type, id);
  }

  @Post(':type/:id/change-vendor')
  changeVendor(
    @CurrentUser() user: JwtAccessPayload,
    @Param('type') type: 'grocery' | 'food',
    @Param('id') id: string,
    @Body() dto: ChangeOrderVendorDto,
  ) {
    return this.orders.changeOrderVendor(user.sub, type, id, dto);
  }
}
