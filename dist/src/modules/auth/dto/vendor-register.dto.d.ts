declare const VENDOR_TYPES: readonly ["grocery", "restaurant", "both"];
export declare class VendorRegisterDto {
    phone: string;
    password: string;
    businessName: string;
    ownerName: string;
    type: (typeof VENDOR_TYPES)[number];
    shopAddress?: string;
    pickupLat: number;
    pickupLng: number;
    radiusKm?: number;
}
export {};
