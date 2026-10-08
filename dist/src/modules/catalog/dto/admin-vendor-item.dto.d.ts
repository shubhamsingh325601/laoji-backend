import { MenuItemAddonInput, MenuItemVariantInput } from './menu.dto';
export declare class BulkDeleteAdminVendorItemsDto {
    itemIds: string[];
}
export declare class CreateAdminVendorItemDto {
    itemType?: 'grocery' | 'menu_item';
    name: string;
    description?: string;
    price: number;
    wholesalePrice?: number;
    unit?: string;
    imageUrl?: string;
    isAvailable?: boolean;
    isVeg?: boolean;
    categoryId?: string;
    stockQty?: number;
    commissionPct?: number;
    productId?: string;
    isCustomisable?: boolean;
    variants?: MenuItemVariantInput[];
    addons?: MenuItemAddonInput[];
}
export declare class UpdateAdminVendorItemDto {
    name?: string;
    description?: string;
    price?: number;
    wholesalePrice?: number;
    unit?: string;
    imageUrl?: string;
    isAvailable?: boolean;
    isVeg?: boolean;
    categoryId?: string;
    stockQty?: number;
    commissionPct?: number;
    isCustomisable?: boolean;
    variants?: MenuItemVariantInput[];
    addons?: MenuItemAddonInput[];
}
