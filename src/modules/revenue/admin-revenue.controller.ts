import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { RevenueConfigService } from './revenue-config.service';
import { SettlementService } from './settlement.service';
import { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminRevenueController {
  constructor(
    private readonly revenueConfig: RevenueConfigService,
    private readonly settlements: SettlementService,
  ) {}

  @Post('revenue-config')
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateRevenueConfigDto) {
    return this.revenueConfig.create(user.sub, dto);
  }

  @Get('revenue-config')
  listAll() {
    return this.revenueConfig.listAll();
  }

  @Get('settlements')
  listSettlements() {
    return this.settlements.listAllForAdmin();
  }
}
