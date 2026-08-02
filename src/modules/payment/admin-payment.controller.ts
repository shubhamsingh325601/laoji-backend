import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { PaymentService } from './payment.service';
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get('pending')
  listPending() {
    return this.payments.listPendingForAdmin();
  }

  @Post(':id/reconcile')
  reconcile(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: ReconcilePaymentDto) {
    return this.payments.reconcile(id, user.sub, dto.status);
  }

  @Get('refunds')
  listRefunds() {
    return this.payments.listRefundsForAdmin();
  }

  @Post(':id/mark-refunded')
  markRefunded(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.payments.markRefunded(id, user.sub);
  }
}
