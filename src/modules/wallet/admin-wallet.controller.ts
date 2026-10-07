import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { WalletService } from './wallet.service';
import { ProcessWithdrawalDto } from './dto/request-withdrawal.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('wallets')
  async listWallets(@Query('role') role?: string, @Query('search') search?: string) {
    return this.wallet.listWallets({ role, search });
  }

  @Get('transactions')
  async listTransactions(@Query('limit') limit?: string) {
    return this.wallet.listAllTransactions(limit ? parseInt(limit, 10) : 100);
  }

  @Get('user/:userId')
  async getUserWallet(@Param('userId') userId: string) {
    return this.wallet.getUserWalletSummary(userId);
  }

  @Get('vendor/:vendorId')
  async getVendorWallet(@Param('vendorId') vendorId: string) {
    return this.wallet.getVendorWalletSummary(vendorId);
  }

  @Post('adjust')
  async adjustWallet(
    @Body() dto: AdjustWalletDto,
    @CurrentUser() admin?: JwtAccessPayload,
  ) {
    return this.wallet.adjustWallet(dto, admin?.sub);
  }

  @Get('requests')
  async listRequests(@Query('status') status?: string) {
    return this.wallet.listAllWithdrawalRequests(status);
  }

  @Post('requests/:id/approve')
  async approveRequest(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.wallet.approveWithdrawal(id, dto?.adminNotes);
  }

  @Post('requests/:id/reject')
  async rejectRequest(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.wallet.rejectWithdrawal(id, dto?.adminNotes);
  }
}
