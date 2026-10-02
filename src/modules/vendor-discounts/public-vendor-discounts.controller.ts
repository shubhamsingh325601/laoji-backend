import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { VendorDiscountsService } from './vendor-discounts.service';

@Controller('vendors/:vendorId/discounts')
export class PublicVendorDiscountsController {
  constructor(
    private readonly discountsService: VendorDiscountsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Get('active')
  async listActive(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Req() req: Request,
  ) {
    const userId = await this.userIdFrom(req);
    const rows = await this.discountsService.getActiveDiscountsForVendor(vendorId, userId);
    return rows.map((d) => ({
      id: d.id,
      vendorId: d.vendorId,
      title: d.title,
      scope: d.scope,
      productId: d.productId,
      menuItemId: d.menuItemId,
      discountType: d.discountType,
      discountValue: d.discountValue,
      maxDiscount: d.maxDiscount,
      minOrderValue: d.minOrderValue,
      startTime: d.startTime,
      endTime: d.endTime,
      startDate: d.startDate,
      endDate: d.endDate,
    }));
  }

  private async userIdFrom(req: Request): Promise<string | undefined> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(header.slice(7), {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
