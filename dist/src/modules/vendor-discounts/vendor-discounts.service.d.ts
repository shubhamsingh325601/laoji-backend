import { OnModuleInit } from '@nestjs/common';
import type { Db } from '../../config/database.module';
import { vendorDiscounts } from '../../../drizzle/schema';
import type { CreateVendorDiscountDto } from './dto/create-vendor-discount.dto';
import type { UpdateVendorDiscountDto } from './dto/update-vendor-discount.dto';
export type VendorDiscountRow = typeof vendorDiscounts.$inferSelect;
export declare function currentIstDateAndMinutes(): {
    dateStr: string;
    minutes: number;
};
export declare function parseTimeMinutes(timeStr?: string | null): number | null;
export declare class VendorDiscountsService implements OnModuleInit {
    private readonly db;
    constructor(db: Db);
    onModuleInit(): Promise<void>;
    listByVendor(vendorId: string): Promise<{
        targetItemName: string;
        id: string;
        vendorId: string;
        title: string;
        scope: string;
        productId: string | null;
        menuItemId: string | null;
        discountType: string;
        discountValue: number;
        maxDiscount: number | null;
        minOrderValue: number;
        totalUsageLimit: number | null;
        usageCount: number;
        perUserLimit: number;
        startTime: string | null;
        endTime: string | null;
        startDate: string | null;
        endDate: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getById(id: string): Promise<VendorDiscountRow>;
    create(vendorId: string, dto: CreateVendorDiscountDto): Promise<VendorDiscountRow>;
    update(id: string, dto: UpdateVendorDiscountDto): Promise<VendorDiscountRow>;
    toggleActive(id: string): Promise<VendorDiscountRow>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getActiveDiscountsForVendor(vendorId: string, userId?: string): Promise<VendorDiscountRow[]>;
    calculateItemDiscount(itemPrice: number, discounts: VendorDiscountRow[], itemTarget: {
        productId?: string;
        menuItemId?: string;
    }): {
        originalPrice: number;
        price: number;
        discountLabel: string | null;
        discountApplied: VendorDiscountRow | null;
    };
    recordRedemption(discountId: string, vendorId: string, userId: string, orderId?: string): Promise<void>;
}
