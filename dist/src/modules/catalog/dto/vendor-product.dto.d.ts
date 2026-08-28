export declare class UpsertVendorProductDto {
    productId: string;
    price: number;
    stockQty: number;
    isAvailable?: boolean;
}
export declare class UpdateVendorProductDto {
    price?: number;
    stockQty?: number;
    isAvailable?: boolean;
}
