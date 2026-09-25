export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function roundKm(km: number): number;
export declare const BUSINESS_TYPES: readonly ["grocery", "restaurant", "clothing", "stationery", "medical", "vegetables_fruits", "electronics", "general"];
export declare const BUSINESS_TYPE_ROOT_CATEGORY: Record<string, string>;
export declare function categoryBusinessType(category: {
    parentId: string | null;
    businessType: string | null;
}, byId: Map<string, {
    businessType: string | null;
}>): string;
export declare function isCategoryVisibleTo(categoryType: string, vendorBusinessType: string): boolean;
export declare const DEFAULT_PICKUP: {
    readonly lat: 24.924;
    readonly lng: 76.283;
};
export declare function isDefaultPickup(lat: number, lng: number): boolean;
export declare function istDateString(now?: Date): string;
export interface BusinessHoursDay {
    day: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
}
export declare function isVendorOpenNow(vendor: {
    isOpen: boolean;
    businessHours: BusinessHoursDay[] | null;
}, now?: Date): boolean;
