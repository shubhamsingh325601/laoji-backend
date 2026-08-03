import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [DashboardController, ReportsController],
  providers: [DashboardService],
})
export class DashboardModule {}
