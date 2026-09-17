import { CatalogService } from './catalog.service';
export declare class PublicCatalogController {
    private readonly catalog;
    constructor(catalog: CatalogService);
    categories(): import("drizzle-orm/pg-core").PgSelectBase<"categories", {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "categories";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        parentId: import("drizzle-orm/pg-core").PgColumn<{
            name: "parent_id";
            tableName: "categories";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "categories";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 150;
        }>;
        imageUrl: import("drizzle-orm/pg-core").PgColumn<{
            name: "image_url";
            tableName: "categories";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    }, "single", Record<"categories", "not-null">, false, never, {
        id: string;
        parentId: string | null;
        name: string;
        imageUrl: string | null;
    }[], {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "categories";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        parentId: import("drizzle-orm/pg-core").PgColumn<{
            name: "parent_id";
            tableName: "categories";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "categories";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 150;
        }>;
        imageUrl: import("drizzle-orm/pg-core").PgColumn<{
            name: "image_url";
            tableName: "categories";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    }>;
    products(lat?: string, lng?: string, categoryId?: string): Promise<{
        price: number;
        inStock: boolean;
        id: string;
        brand: string | null;
        name: string;
        status: "active" | "inactive";
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        categoryId: string;
        unit: string;
        size: string | null;
        mrp: number | null;
    }[]>;
    product(id: string, lat?: string, lng?: string): Promise<{
        price: number;
        inStock: boolean;
        id: string;
        categoryId: string;
        brand: string | null;
        name: string;
        description: string | null;
        unit: string;
        size: string | null;
        mrp: number | null;
        imageUrl: string | null;
        status: "active" | "inactive";
        createdAt: Date;
    }>;
    restaurants(lat?: string, lng?: string): Promise<{
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
        imageUrl: string | null;
        ratingAvg: number;
        isOpen: boolean;
    }[]>;
    restaurant(id: string): Promise<{
        isOpen: boolean;
        menuCategories: {
            items: {
                addons: {
                    id: string;
                    menuItemId: string;
                    name: string;
                    price: number;
                    isRequired: boolean;
                }[];
                variants: {
                    id: string;
                    menuItemId: string;
                    name: string;
                    priceDelta: number;
                    isDefault: boolean;
                }[];
                id: string;
                menuCategoryId: string;
                name: string;
                description: string | null;
                price: number;
                imageUrl: string | null;
                isVeg: boolean;
                isAvailable: boolean;
            }[];
            id: string;
            restaurantId: string;
            name: string;
            sortOrder: number;
        }[];
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
        imageUrl: string | null;
        ratingAvg: number;
    }>;
    search(lat?: string, lng?: string, q?: string): Promise<{
        products: any[];
        restaurants: any[];
        dishes: any[];
    }>;
}
