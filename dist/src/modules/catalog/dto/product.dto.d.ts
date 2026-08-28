declare const STATUSES: readonly ["active", "inactive"];
export declare class CreateProductDto {
    categoryId: string;
    name: string;
    brand?: string;
    description?: string;
    unit: string;
    size?: string;
    mrp?: number;
    imageUrl?: string;
}
export declare class UpdateProductDto {
    categoryId?: string;
    name?: string;
    brand?: string;
    description?: string;
    unit?: string;
    size?: string;
    mrp?: number;
    imageUrl?: string;
    status?: (typeof STATUSES)[number];
}
export {};
