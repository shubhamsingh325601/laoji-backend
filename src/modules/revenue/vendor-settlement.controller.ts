import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { SettlementService } from './settlement.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor')
@Controller('vendor/settlements')
export class VendorSettlementController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload) {
    const vendorId = await this.settlements.vendorIdForUser(user.sub);
    return this.settlements.listForVendor(vendorId);
  }

  @Post('withdraw')
  async withdraw(@CurrentUser() user: JwtAccessPayload) {
    return this.settlements.requestVendorWithdrawal(user.sub);
  }
}
