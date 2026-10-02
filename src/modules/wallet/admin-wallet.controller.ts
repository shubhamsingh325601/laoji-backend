import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WalletService } from './wallet.service';
import { ProcessWithdrawalDto } from './dto/request-withdrawal.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}

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
