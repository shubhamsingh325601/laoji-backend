declare const VENDOR_TYPES: readonly ["grocery", "restaurant", "both"];
export declare class UpsertVendorProfileDto {
    businessName: string;
    ownerName: string;
    type: (typeof VENDOR_TYPES)[number];
    shopAddress?: string;
    pickupLat: number;
    pickupLng: number;
    radiusKm?: number;
    gstNumber?: string;
    aadhaarNumber?: string;
    bankAccount?: string;
    bankIfsc?: string;
    upiId?: string;
}
export {};
