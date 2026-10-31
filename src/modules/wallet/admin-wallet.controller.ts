import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { WalletService } from './wallet.service';
import { ProcessWithdrawalDto } from './dto/request-withdrawal.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import {
  AdjustScratchCardExpiryDto,
  AdjustWalletCreditExpiryDto,
  RestoreScratchCardDto,
  RestoreWalletCreditDto,
  UpdateExpirySettingsDto,
} from './dto/expiry-admin.dto';

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

  // ================= SCRATCH CARD ADMIN =================

  @Get('scratch-cards')
  async listScratchCards(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.listAllScratchCards({
      userId,
      status,
      search,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post('scratch-cards/:id/restore')
  async restoreScratchCard(
    @Param('id') id: string,
    @Body() dto: RestoreScratchCardDto,
  ) {
    return this.wallet.restoreScratchCard(id, dto);
  }

  @Post('scratch-cards/:id/adjust-expiry')
  async adjustScratchCardExpiry(
    @Param('id') id: string,
    @Body() dto: AdjustScratchCardExpiryDto,
  ) {
    return this.wallet.adjustScratchCardExpiry(id, dto);
  }

  // ================= CUSTOMER CREDITS & WALLET EXPIRY =================

  @Get('customer/:userId/credits')
  async getCustomerCredits(@Param('userId') userId: string) {
    return this.wallet.getCustomerCredits(userId);
  }

  @Post('credits/:id/restore')
  async restoreWalletCredit(
    @Param('id') id: string,
    @Body() dto: RestoreWalletCreditDto,
    @CurrentUser() admin?: JwtAccessPayload,
  ) {
    return this.wallet.restoreWalletCredit(id, dto, admin?.sub);
  }

  @Post('credits/:id/adjust-expiry')
  async adjustWalletCreditExpiry(
    @Param('id') id: string,
    @Body() dto: AdjustWalletCreditExpiryDto,
  ) {
    return this.wallet.adjustWalletCreditExpiry(id, dto);
  }

  // ================= EXPIRY SETTINGS =================

  @Get('settings/expiry')
  async getExpirySettings() {
    return this.wallet.getExpirySettings();
  }

  @Post('settings/expiry')
  async updateExpirySettings(@Body() dto: UpdateExpirySettingsDto) {
    return this.wallet.updateExpirySettings(dto);
  }

  @Post('process-expiries')
  async processExpiries() {
    return this.wallet.processAllExpirations();
  }
}
