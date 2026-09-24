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
