import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

const ALLOWED_DAYS = [7, 30, 90];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles('admin')
  @Get('series')
  series(@Query('days') daysRaw?: string) {
    const parsed = Number(daysRaw);
    const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;
    return this.dashboard.getSeries(days);
  }

  @Roles('admin', 'vendor')
  @Get('vendor-performance')
  vendorPerformance(@Query('month') month?: string) {
    return this.dashboard.getVendorPerformance(month);
  }

  @Roles('admin')
  @Get('vendors/:id/summary')
  vendorSummary(@Param('id', ParseUUIDPipe) id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.getVendorSummary(id, from, to);
  }

  @Roles('admin')
  @Get('cancellations')
  cancellations() {
    return this.dashboard.getCancellations();
  }
}
