import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { VendorWithdrawalService } from './vendor-withdrawal.service';
import { ApproveWithdrawalDto, RejectWithdrawalDto } from './dto/vendor-withdrawal.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/vendor-withdrawals')
export class AdminWithdrawalController {
  constructor(private readonly withdrawals: VendorWithdrawalService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.withdrawals.listForAdmin(status === 'pending' || status === 'approved' || status === 'rejected' ? status : undefined);
  }

  // Full breakdown: the period since the last approved request and every order in it.
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.withdrawals.getForAdmin(id);
  }

  // Admin has sent the money by hand; `payoutReference` is the optional UTR / txn id.
  @Post(':id/approve')
  approve(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return this.withdrawals.approve(id, user.sub, dto.payoutReference);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawals.reject(id, user.sub, dto.reason);
  }
}
