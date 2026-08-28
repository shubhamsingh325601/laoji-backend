export declare class CreateMenuCategoryDto {
    name: string;
    sortOrder?: number;
}
export declare class UpdateMenuCategoryDto {
    name?: string;
    sortOrder?: number;
}
export declare class MenuItemAddonInput {
    name: string;
    price: number;
    isRequired?: boolean;
}
export declare class MenuItemVariantInput {
    name: string;
    priceDelta: number;
    isDefault?: boolean;
}
export declare class CreateMenuItemDto {
    menuCategoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isVeg?: boolean;
    addons?: MenuItemAddonInput[];
    variants?: MenuItemVariantInput[];
}
export declare class UpdateMenuItemDto {
    menuCategoryId?: string;
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    isVeg?: boolean;
    isAvailable?: boolean;
    addons?: MenuItemAddonInput[];
    variants?: MenuItemVariantInput[];
}
