import type { Db } from '../../config/database.module';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';
export declare class CouponService {
    private readonly db;
    constructor(db: Db);
    listAllForAdmin(): Promise<{
        id: string;
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
        isActive: boolean;
        createdAt: Date;
    }[]>;
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
    create(dto: CreateCouponDto): Promise<{
        id: string;
        createdAt: Date;
        description: string | null;
        isActive: boolean;
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        isFirstOrderOnly: boolean;
    }>;
    update(id: string, dto: UpdateCouponDto): Promise<{
        id: string;
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
        isActive: boolean;
        createdAt: Date;
    }>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    validate(code: string, subtotal: number, userId?: string): Promise<{
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
