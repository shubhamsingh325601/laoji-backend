import type { Db } from '../../config/database.module';
import type { GrocerySizeInput } from './dto/admin-vendor-item.dto';
export declare const GROCERY_SIZES_SETTING = "grocery_sizes_enabled";
export interface AdminGrocerySize {
    listingId: string;
    productId: string;
    label: string;
    price: number;
    stockQty: number;
    isAvailable: boolean;
}
export interface PublicGrocerySize {
    productId: string;
    label: string;
    price: number;
    mrp: number | null;
    inStock: boolean;
}
export declare class GrocerySizesService {
    private readonly db;
    private flag;
    constructor(db: Db);
    isEnabled(): Promise<boolean>;
    setEnabled(enabled: boolean, adminId?: string): Promise<{
        grocerySizes: boolean;
    }>;
    assertValidLabels(unit: string, sizes: {
        label: string;
    }[]): void;
    syncSizes(vendorId: string, listingId: string, sizes: GrocerySizeInput[]): Promise<void>;
    adminSizesFor(row: {
        id: string;
        productId: string;
        variantGroupId: string | null;
    }, rows: {
        id: string;
        productId: string;
        variantGroupId: string | null;
        variantLabel: string | null;
        unit: string;
        price: number;
        stockQty: number;
        isAvailable: boolean;
    }[]): AdminGrocerySize[];
    withPublicSizes<T extends {
        id: string;
        variantGroupId?: string | null;
        variantLabel?: string | null;
        unit: string;
        price: number;
        mrp?: number | null;
        inStock: boolean;
    }>(items: T[]): (T & {
        sizes: PublicGrocerySize[];
    })[];
    siblingProductIds(product: {
        id: string;
        variantGroupId?: string | null;
    }): Promise<string[]>;
    private siblingsAt;
    private removeSize;
}
