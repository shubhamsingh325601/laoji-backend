export declare class CreateGroceryProductDto {
    categoryId: string;
    name: string;
    brand?: string;
    unit: string;
    size?: string;
    mrp?: number;
    imageUrl?: string;
    price: number;
    stockQty: number;
    offerTag?: string;
    lowStockThreshold?: number;
    attributes?: Record<string, unknown>;
}
