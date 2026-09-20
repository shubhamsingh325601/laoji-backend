declare const VENDOR_TYPES: readonly ["grocery", "restaurant", "both"];
export declare class VendorRegisterDto {
    phone: string;
    email?: string;
    password: string;
    businessName: string;
    ownerName: string;
    type: (typeof VENDOR_TYPES)[number];
    shopAddress?: string;
    pickupLat: number;
    pickupLng: number;
    radiusKm?: number;
    businessType?: string;
    imageUrl?: string;
}
export {};
