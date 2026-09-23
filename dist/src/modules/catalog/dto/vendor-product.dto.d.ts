export declare class UpsertVendorProductDto {
    productId: string;
    price: number;
    stockQty: number;
    isAvailable?: boolean;
    offerTag?: string;
    lowStockThreshold?: number;
}
export declare class UpdateVendorProductDto {
    price?: number;
    stockQty?: number;
    isAvailable?: boolean;
    offerTag?: string;
    lowStockThreshold?: number;
}
