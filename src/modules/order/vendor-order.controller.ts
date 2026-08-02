import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { OrderService } from './order.service';
import { AdvanceStatusDto, CorrectStatusDto } from './dto/advance-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor')
@Controller('vendor/orders')
export class VendorOrderController {
  constructor(private readonly orders: OrderService) {}

  @Get('grocery/incoming')
  groceryIncoming(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listVendorIncomingGroceryOrders(user.sub);
  }

  @Get('grocery/active')
  groceryActive(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listVendorActiveGroceryOrders(user.sub);
  }

  @Get('grocery/history')
  groceryHistory(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listVendorHistoryGroceryOrders(user.sub);
  }

  @Get('grocery/:id')
  groceryOrder(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.getGroceryOrder(id, { userId: user.sub, role: user.role });
  }

  @Post('grocery/:id/accept')
  acceptGrocery(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.acceptGroceryOrder(user.sub, id);
  }

  @Post('grocery/:id/reject')
  rejectGrocery(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.rejectGroceryOrder(user.sub, id);
  }

  @Patch('grocery/:id/advance')
  advanceGrocery(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: AdvanceStatusDto) {
    return this.orders.advanceGroceryOrder(user.sub, id, dto);
  }

  @Patch('grocery/:id/correct-status')
  correctGrocery(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: CorrectStatusDto) {
    return this.orders.correctGroceryOrderStatus(user.sub, id, dto);
  }

  @Get('food/incoming')
  foodIncoming(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listVendorIncomingFoodOrders(user.sub);
  }

  @Get('food/active')
  foodActive(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listVendorActiveFoodOrders(user.sub);
  }

  @Get('food/history')
  foodHistory(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listVendorHistoryFoodOrders(user.sub);
  }

  @Get('food/:id')
  foodOrder(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.getFoodOrder(id, { userId: user.sub, role: user.role });
  }

  @Post('food/:id/accept')
  acceptFood(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.acceptFoodOrder(user.sub, id);
  }

  @Post('food/:id/reject')
  rejectFood(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.rejectFoodOrder(user.sub, id);
  }

  @Patch('food/:id/advance')
  advanceFood(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: AdvanceStatusDto) {
    return this.orders.advanceFoodOrder(user.sub, id, dto);
  }

  @Patch('food/:id/correct-status')
  correctFood(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: CorrectStatusDto) {
    return this.orders.correctFoodOrderStatus(user.sub, id, dto);
  }
}
