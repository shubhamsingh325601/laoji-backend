export declare class VendorProductDetailsDto {
    name?: string;
    brand?: string;
    categoryId?: string;
    unit?: string;
    size?: string;
    mrp?: number | null;
    imageUrl?: string;
    description?: string;
    attributes?: Record<string, unknown>;
}
export declare class UpsertVendorProductDto extends VendorProductDetailsDto {
    productId: string;
    price: number;
    stockQty: number;
    isAvailable?: boolean;
    offerTag?: string;
    lowStockThreshold?: number;
    restockEta?: string | null;
}
export declare class UpdateVendorProductDto extends VendorProductDetailsDto {
    price?: number;
    stockQty?: number;
    isAvailable?: boolean;
    offerTag?: string;
    lowStockThreshold?: number;
    restockEta?: string | null;
}
export declare class RestockVendorProductDto {
    qty: number;
}
export declare class CreateVendorCustomProductDto {
    name: string;
    brand?: string;
    categoryId: string;
    unit: string;
    size?: string;
    mrp?: number;
    price: number;
    stockQty?: number;
    isAvailable?: boolean;
    description?: string;
    imageUrl?: string;
}
export declare class UpdateVendorCustomProductDto {
    name?: string;
    brand?: string;
    categoryId?: string;
    unit?: string;
    size?: string;
    mrp?: number;
    price?: number;
    stockQty?: number;
    isAvailable?: boolean;
    description?: string;
    imageUrl?: string;
}
