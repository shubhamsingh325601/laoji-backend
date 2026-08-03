import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

const ALLOWED_DAYS = [7, 30, 90];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('reports')
export class ReportsController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('series')
  series(@Query('days') daysRaw?: string) {
    const parsed = Number(daysRaw);
    const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;
    return this.dashboard.getSeries(days);
  }

  @Get('vendor-performance')
  vendorPerformance() {
    return this.dashboard.getVendorPerformance();
  }

  @Get('cancellations')
  cancellations() {
    return this.dashboard.getCancellations();
  }
}
