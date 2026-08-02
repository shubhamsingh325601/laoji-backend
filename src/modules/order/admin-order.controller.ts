import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
}
