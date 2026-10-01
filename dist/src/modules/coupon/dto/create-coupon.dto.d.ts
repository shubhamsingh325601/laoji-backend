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
}
