import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { SettlementService } from './settlement.service';
import { VendorWithdrawalService } from './vendor-withdrawal.service';
import { RequestVendorWithdrawalDto } from './dto/vendor-withdrawal.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor')
@Controller('vendor/settlements')
export class VendorSettlementController {
  constructor(
    private readonly settlements: SettlementService,
    private readonly withdrawals: VendorWithdrawalService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload) {
    const vendorId = await this.settlements.vendorIdForUser(user.sub);
    return this.settlements.listForVendor(vendorId);
  }

  // Balance + the vendor's own request history (pending / approved / rejected with reason).
  @Get('withdrawals')
  listWithdrawals(@CurrentUser() user: JwtAccessPayload) {
    return this.withdrawals.listForVendor(user.sub);
  }

  @Get('withdrawal-limit')
  async getWithdrawalLimit() {
    return { minWithdrawalLimit: await this.withdrawals.getMinWithdrawalLimit() };
  }

  // No `amount` = withdraw the whole available balance (what older app builds send).
  @Post('withdraw')
  withdraw(@CurrentUser() user: JwtAccessPayload, @Body() dto: RequestVendorWithdrawalDto) {
    return this.withdrawals.request(user.sub, dto.amount);
  }

}
