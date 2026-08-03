import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { OrderService } from './order.service';
import { CreateGroceryOrderDto } from './dto/create-grocery-order.dto';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
@Controller('orders')
export class CustomerOrderController {
  constructor(private readonly orders: OrderService) {}

  @Throttle({ orderCreate: { limit: 10, ttl: 60_000 } })
  @Post('grocery')
  createGrocery(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateGroceryOrderDto) {
    return this.orders.createGroceryOrder(user.sub, dto);
  }

  @Get('grocery')
  myGroceryOrders(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listMyGroceryOrders(user.sub);
  }

  @Get('grocery/:id')
  groceryOrder(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.getGroceryOrder(id, { userId: user.sub, role: user.role });
  }

  @Throttle({ orderCreate: { limit: 10, ttl: 60_000 } })
  @Post('food')
  createFood(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateFoodOrderDto) {
    return this.orders.createFoodOrder(user.sub, dto);
  }

  @Get('food')
  myFoodOrders(@CurrentUser() user: JwtAccessPayload) {
    return this.orders.listMyFoodOrders(user.sub);
  }

  @Get('food/:id')
  foodOrder(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.orders.getFoodOrder(id, { userId: user.sub, role: user.role });
  }
}
