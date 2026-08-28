export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
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
