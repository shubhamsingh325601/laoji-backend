import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
export declare class AdminCouponController {
    private readonly couponService;
    constructor(couponService: CouponService);
    listAll(): Promise<{
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
        vendorId: string | null;
        createdAt: Date;
    }[]>;
    listByVendor(vendorId: string): Promise<{
        code: string;
        discountType: string;
        discountValue: number;
        minOrderValue: number;
        maxDiscount: number | null;
        description: string | null;
        isFirstOrderOnly: boolean;
        firstNOrders: number | null;
        vendorId: string | null;
        id: string;
    }[]>;
    create(dto: CreateCouponDto): Promise<{
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
        vendorId: string | null;
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
        vendorId: string | null;
        createdAt: Date;
    }>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
