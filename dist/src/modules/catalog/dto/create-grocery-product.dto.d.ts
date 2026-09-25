export declare class CreateGroceryProductDto {
    categoryId: string;
    name: string;
    brand?: string;
    unit: string;
    size?: string;
    mrp?: number;
    imageUrl?: string;
    description?: string;
    price: number;
    stockQty: number;
    offerTag?: string;
    lowStockThreshold?: number;
    isAvailable?: boolean;
    restockEta?: string | null;
    attributes?: Record<string, unknown>;
}
