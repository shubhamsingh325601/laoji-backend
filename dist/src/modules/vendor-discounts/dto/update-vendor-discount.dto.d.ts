export declare class UpdateVendorDiscountDto {
    title?: string;
    scope?: 'entire_store' | 'product';
    productId?: string | null;
    menuItemId?: string | null;
    discountType?: 'flat' | 'percentage';
    discountValue?: number;
    maxDiscount?: number | null;
    minOrderValue?: number;
    totalUsageLimit?: number | null;
    perUserLimit?: number;
    startTime?: string | null;
    endTime?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive?: boolean;
}
