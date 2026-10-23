import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats() {
    return this.dashboard.getStats();
  }

  @Get('attention')
  attention() {
    return this.dashboard.getAttention();
  }

  @Get('overview')
  overview() {
    return this.dashboard.getOverview();
  }

  @Get('summary')
  summary() {
    return this.dashboard.getSummary();
  }

  @Get('recent-orders')
  recentOrders(@Query('limit') limit?: string) {
    return this.dashboard.getRecentOrders(limit ? Number(limit) : undefined);
  }
}
