import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller('coupons')
export class PublicCouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('active')
  listActive() {
    return this.couponService.listActive();
  }

  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto, @Req() req: Request) {
    let userId = dto.userId;

    // If userId not provided in body, try extracting from Authorization Bearer token
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded: any = this.jwtService.decode(token);
          if (decoded && decoded.sub) {
            userId = decoded.sub;
          }
        } catch {
          // ignore token decode failure
        }
      }
    }

    return this.couponService.validate(dto.code, dto.subtotal, userId);
  }
}
