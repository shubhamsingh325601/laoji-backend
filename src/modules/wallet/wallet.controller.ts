import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { WalletService } from './wallet.service';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  async getMyWallet(@CurrentUser() user: JwtAccessPayload) {
    return this.wallet.getWalletSummary(user.sub);
  }

  @Post('withdraw')
  async requestWithdrawal(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.wallet.requestWithdrawal(user.sub, dto);
  }
}
