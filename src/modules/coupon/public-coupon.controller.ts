import { Body, Controller, Get, Query, Post, Req, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller('coupons')
export class PublicCouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  @UseInterceptors(ResponseCacheInterceptor)
  @Get('active')
  listActive(@Query('vendorId') vendorId?: string) {
    return this.couponService.listActive(vendorId);
  }

  // Open to guests. "First N orders" is only checked for a caller with a
  // valid access token; `userId` in the body is ignored so nobody can probe
  // another customer's eligibility. Order quote/create re-check it anyway.
  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto, @Req() req: Request) {
    const vendorId = dto.vendorId; // optional, from app context
    return this.couponService.validate(dto.code, dto.subtotal, await this.userIdFrom(req), vendorId);
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
