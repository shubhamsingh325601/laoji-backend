import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { OrderService } from './order.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  listAll() {
    return this.orders.listAllOrdersForAdmin();
  }

  @Get(':type/:id')
  timeline(@Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.orders.getOrderTimelineForAdmin(type, id);
  }

  @Post(':type/:id/cancel')
  cancel(@CurrentUser() user: JwtAccessPayload, @Param('type') type: 'grocery' | 'food', @Param('id') id: string) {
    return this.orders.cancelOrder(user.sub, type, id);
  }
}
