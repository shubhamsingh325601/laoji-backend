export declare class CreateAdminVendorDto {
    businessName: string;
    ownerName: string;
    phone: string;
    email?: string;
    type: 'grocery' | 'restaurant' | 'both';
    shopAddress?: string;
    pickupLat?: number;
    pickupLng?: number;
    deliveryRadiusKm?: number;
    commissionPct?: number;
    kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
    gstNumber?: string;
    aadhaarNumber?: string;
    bankAccount?: string;
    bankIfsc?: string;
    upiId?: string;
}
export declare class UpdateAdminVendorDto {
    businessName?: string;
    ownerName?: string;
    phone?: string;
    email?: string;
    type?: 'grocery' | 'restaurant' | 'both';
    shopAddress?: string;
    deliveryRadiusKm?: number;
    commissionPct?: number;
    cashbackPct?: number;
    discountPct?: number;
    minOrderValue?: number;
    maxDiscountCap?: number;
    kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
    activity?: 'active' | 'inactive';
    isOpen?: boolean;
    gstNumber?: string;
    aadhaarNumber?: string;
    bankAccount?: string;
    bankIfsc?: string;
    upiId?: string;
}
