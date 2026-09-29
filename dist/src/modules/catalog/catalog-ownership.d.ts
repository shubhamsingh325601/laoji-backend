interface CategoryRef {
    id: string;
    ownerVendorId: string | null;
    templateCategoryId: string | null;
}
export declare function ownCopiesByTemplate<C extends CategoryRef>(categories: C[], vendorId: string): Map<string, C>;
export declare function shopCategoryId(categoryId: string, copies: Map<string, {
    id: string;
}>): string;
export declare function laojiCategoryId(categoryId: string, byId: Map<string, CategoryRef>): string;
export type ProductAttributes = Record<string, string | number | boolean>;
export declare function normalizeAttributes(attributes: Record<string, unknown> | null | undefined): ProductAttributes | null;
export interface ProductDetailColumns {
    name: string;
    brand: string | null;
    categoryId: string;
    unit: string;
    size: string | null;
    mrp: number | null;
    imageUrl: string | null;
    description: string | null;
    attributes: ProductAttributes | null;
}
export interface ProductDetailInput {
    name?: string;
    brand?: string;
    categoryId?: string;
    unit?: string;
    size?: string;
    mrp?: number | null;
    imageUrl?: string;
    description?: string;
    attributes?: ProductAttributes | null;
}
export declare function productDetailChanges(product: ProductDetailColumns, input: ProductDetailInput, sameCategory: (categoryId: string) => boolean): Partial<ProductDetailColumns>;
export {};
