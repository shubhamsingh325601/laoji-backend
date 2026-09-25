import { CatalogService } from './catalog.service';
export declare class PublicCatalogController {
    private readonly catalog;
    constructor(catalog: CatalogService);
    categories(): Promise<{
        id: string;
        parentId: string | null;
        name: string;
        imageUrl: string | null;
        businessType: string | null;
        ownerVendorId: string | null;
        templateCategoryId: string | null;
    }[]>;
    products(lat?: string, lng?: string, categoryId?: string): Promise<{
        categoryId: string;
        price: number;
        inStock: boolean;
        restockEta: string | null;
        id: string;
        brand: string | null;
        name: string;
        status: "active" | "inactive";
        createdAt: Date;
        imageUrl: string | null;
        ownerVendorId: string | null;
        description: string | null;
        unit: string;
        size: string | null;
        mrp: number | null;
        attributes: Record<string, string | number | boolean> | null;
        templateProductId: string | null;
    }[]>;
    product(id: string, lat?: string, lng?: string): Promise<{
        categoryId: string;
        price: number;
        inStock: boolean;
        restockEta: string | null;
        id: string;
        brand: string | null;
        name: string;
        description: string | null;
        unit: string;
        size: string | null;
        mrp: number | null;
        imageUrl: string | null;
        attributes: Record<string, string | number | boolean> | null;
        status: "active" | "inactive";
        ownerVendorId: string | null;
        templateProductId: string | null;
        createdAt: Date;
    }>;
    restaurants(lat?: string, lng?: string): Promise<{
        mealTimings: {
            label: string;
            slot: import("./meal-slots").MealSlot;
            start: string;
            end: string;
        }[];
        imageUrl: string | null;
        ratingAvg: number;
        ratingCount: number;
        isOpen: boolean;
        distanceKm: number;
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
    }[]>;
    restaurant(id: string, lat?: string, lng?: string): Promise<{
        imageUrl: string | null;
        ratingAvg: number;
        ratingCount: number;
        isOpen: boolean;
        menuCategories: {
            id: string;
            name: string;
            items: any[];
        }[];
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
        mealTimings: {
            slot: string;
            start: string;
            end: string;
        }[] | null;
    } | {
        menuCategories: {
            items: {
                mealSlots: string[];
                servedNow: boolean;
                isAvailable: boolean;
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
            }[];
            id: string;
            restaurantId: string;
            name: string;
            sortOrder: number;
        }[];
        distanceKm?: number | undefined;
        deliversToYou?: boolean | undefined;
        mealTimings: {
            label: string;
            slot: import("./meal-slots").MealSlot;
            start: string;
            end: string;
        }[];
        imageUrl: string | null;
        ratingAvg: number;
        ratingCount: number;
        isOpen: boolean;
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
    }>;
    vendorListings(id: string): Promise<{
        id: string;
        name: string;
        category: string;
        price: number;
        unit: string;
        available: boolean;
    }[]>;
    search(lat?: string, lng?: string, q?: string): Promise<{
        products: {
            categoryId: string;
            price: number;
            inStock: boolean;
            restockEta: string | null;
            id: string;
            brand: string | null;
            name: string;
            status: "active" | "inactive";
            createdAt: Date;
            imageUrl: string | null;
            ownerVendorId: string | null;
            description: string | null;
            unit: string;
            size: string | null;
            mrp: number | null;
            attributes: Record<string, string | number | boolean> | null;
            templateProductId: string | null;
        }[];
        restaurants: (Omit<{
            id: string;
            name: string;
            isOpen: boolean;
            imageUrl: string | null;
            vendorId: string;
            cuisineTags: string | null;
            ratingAvg: number;
            mealTimings: {
                slot: string;
                start: string;
                end: string;
            }[] | null;
        }, "mealTimings"> & {
            mealTimings: ReturnType<typeof import("./meal-slots").mealTimingsView>;
            distanceKm: number;
        })[];
        dishes: any[];
    }>;
}
