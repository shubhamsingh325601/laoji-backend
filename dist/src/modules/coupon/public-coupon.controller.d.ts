import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
export declare class PublicCouponController {
    private readonly couponService;
    private readonly jwtService;
    private readonly config;
    constructor(couponService: CouponService, jwtService: JwtService, config: ConfigService);
    listActive(vendorId?: string): Promise<{
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
        firstNOrders: number | null;
        vendorId: string | null;
        showInApp: boolean;
        startsAt: Date | null;
        expiresAt: Date | null;
        id: string;
    }[]>;
    listCoupons(vendorId?: string): Promise<{
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
        firstNOrders: number | null;
        vendorId: string | null;
        showInApp: boolean;
        startsAt: Date | null;
        expiresAt: Date | null;
        id: string;
    }[]>;
    validate(dto: ValidateCouponDto, req: Request): Promise<import("./coupon.service").CouponEvaluation>;
    private userIdFrom;
}
