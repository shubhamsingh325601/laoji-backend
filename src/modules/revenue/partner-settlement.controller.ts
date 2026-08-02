import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { SettlementService } from './settlement.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
@Controller('delivery/settlements')
export class PartnerSettlementController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload) {
    const partnerId = await this.settlements.partnerIdForUser(user.sub);
    return this.settlements.listForPartner(partnerId);
  }
}
