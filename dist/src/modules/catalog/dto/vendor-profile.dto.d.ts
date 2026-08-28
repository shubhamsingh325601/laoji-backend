declare const VENDOR_TYPES: readonly ["grocery", "restaurant", "both"];
export declare class UpsertVendorProfileDto {
    businessName: string;
    ownerName: string;
    type: (typeof VENDOR_TYPES)[number];
    pickupLat: number;
    pickupLng: number;
    radiusKm?: number;
}
export {};
