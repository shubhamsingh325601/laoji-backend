export declare class CreateAdminVendorItemDto {
    itemType?: 'grocery' | 'menu_item';
    name: string;
    description?: string;
    price: number;
    unit?: string;
    imageUrl?: string;
    isAvailable?: boolean;
    isVeg?: boolean;
    categoryId?: string;
    stockQty?: number;
    productId?: string;
}
export declare class UpdateAdminVendorItemDto {
    name?: string;
    description?: string;
    price?: number;
    unit?: string;
    imageUrl?: string;
    isAvailable?: boolean;
    isVeg?: boolean;
    categoryId?: string;
    stockQty?: number;
}
