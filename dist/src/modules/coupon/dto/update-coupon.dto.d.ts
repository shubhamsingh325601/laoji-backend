export declare class UpdateCouponDto {
    code?: string;
    discountType?: 'flat' | 'percentage' | 'free_delivery';
    discountValue?: number;
    minOrderValue?: number;
    maxDiscount?: number;
    description?: string;
    isFirstOrderOnly?: boolean;
    firstNOrders?: number | null;
    isActive?: boolean;
    vendorId?: string | null;
    beneficiaryUserId?: string | null;
    showInApp?: boolean;
    affiliateCommissionType?: 'percentage' | 'flat' | null;
    affiliateCommissionValue?: number | null;
    maxUsesPerUser?: number | null;
    maxTotalUses?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
}
