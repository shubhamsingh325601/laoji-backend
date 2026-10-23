import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
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

  @Get('referral')
  async myReferral(@CurrentUser() user: JwtAccessPayload) {
    return this.wallet.getReferralSummary(user.sub);
  }

  @Get('scratch-cards')
  async myScratchCards(@CurrentUser() user: JwtAccessPayload) {
    return this.wallet.listScratchCards(user.sub);
  }

  @Post('scratch-cards/:id/scratch')
  async scratchCard(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.wallet.scratchCard(user.sub, id);
  }

  @Post('withdraw')
  async requestWithdrawal(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.wallet.requestWithdrawal(user.sub, dto);
  }
}
