import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { CouponService } from './coupon.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
export declare class PublicCouponController {
    private readonly couponService;
    private readonly jwtService;
    constructor(couponService: CouponService, jwtService: JwtService);
    listActive(): Promise<{
        id: string;
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
    }[]>;
    validate(dto: ValidateCouponDto, req: Request): Promise<{
        valid: boolean;
        message: string;
        discount: number;
        coupon?: undefined;
    } | {
        valid: boolean;
        message: string;
        discount: number;
        coupon: {
            code: string;
            discountType: string;
            discountValue: number;
            minOrderValue: number;
            maxDiscount: number | null;
            description: string | null;
            isFirstOrderOnly: boolean;
        };
    }>;
}
