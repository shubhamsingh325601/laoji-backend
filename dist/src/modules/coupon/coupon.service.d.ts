import type { Db } from '../../config/database.module';
import { coupons } from '../../../drizzle/schema';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';
type CouponRow = typeof coupons.$inferSelect;
export interface CouponEvaluation {
    valid: boolean;
    message: string;
    discount: number;
    coupon?: ReturnType<typeof toPublicCoupon>;
}
declare function toPublicCoupon(c: CouponRow): {
    code: string;
    discountType: string;
    discountValue: number;
    minOrderValue: number;
    maxDiscount: number | null;
    description: string | null;
    isFirstOrderOnly: boolean;
    firstNOrders: number | null;
};
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
        firstNOrders: number | null;
        isActive: boolean;
        createdAt: Date;
    }[]>;
    listActive(): Promise<{
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
        firstNOrders: number | null;
        id: string;
    }[]>;
    create(dto: CreateCouponDto): Promise<{
        id: string;
        createdAt: Date;
        description: string | null;
        minOrderValue: number;
        isActive: boolean;
        code: string;
        discountType: string;
        discountValue: number;
        maxDiscount: number | null;
        isFirstOrderOnly: boolean;
        firstNOrders: number | null;
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
        firstNOrders: number | null;
        isActive: boolean;
        createdAt: Date;
    }>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    countPlacedOrders(userId: string): Promise<number>;
    evaluate(code: string, ctx: {
        subtotal: number;
        deliveryFee: number;
        userId?: string;
    }): Promise<CouponEvaluation>;
    findAutoApply(ctx: {
        subtotal: number;
        deliveryFee: number;
        userId: string;
    }): Promise<{
        code: string;
        evaluation: CouponEvaluation;
    } | null>;
    validate(code: string, subtotal: number, userId?: string): Promise<CouponEvaluation>;
}
export {};
