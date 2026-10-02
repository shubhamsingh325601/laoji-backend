export declare class CreateCouponDto {
    code: string;
    discountType: 'flat' | 'percentage' | 'free_delivery';
    discountValue: number;
    minOrderValue?: number;
    maxDiscount?: number;
    description?: string;
    isFirstOrderOnly?: boolean;
    firstNOrders?: number | null;
    isActive?: boolean;
    vendorId?: string;
    beneficiaryUserId?: string;
    showInApp?: boolean;
    affiliateCommissionType?: 'percentage' | 'flat';
    affiliateCommissionValue?: number;
    maxUsesPerUser?: number;
    maxTotalUses?: number;
    startsAt?: string;
    expiresAt?: string;
}
