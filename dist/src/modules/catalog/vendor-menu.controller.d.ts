import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { UpdateRestaurantDto } from './dto/restaurant.dto';
import { CreateMenuCategoryDto, CreateMenuItemDto, UpdateMenuCategoryDto, UpdateMenuItemDto } from './dto/menu.dto';
import { UpdateMealTimingsDto } from './dto/meal-timings.dto';
export declare class VendorMenuController {
    private readonly catalog;
    constructor(catalog: CatalogService);
    myRestaurant(user: JwtAccessPayload): Promise<{
        name: string;
        imageUrl: string | null;
        id: string;
        isOpen: boolean;
        vendorId: string;
        cuisineTags: string | null;
        ratingAvg: number;
        mealTimings: {
            slot: string;
            start: string;
            end: string;
        }[] | null;
    }>;
    updateRestaurant(user: JwtAccessPayload, dto: UpdateRestaurantDto): Promise<{
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
        imageUrl: string | null;
        ratingAvg: number;
        isOpen: boolean;
        mealTimings: {
            slot: string;
            start: string;
            end: string;
        }[] | null;
    }>;
    mealTimings(user: JwtAccessPayload): Promise<{
        label: string;
        slot: import("./meal-slots").MealSlot;
        start: string;
        end: string;
    }[]>;
    updateMealTimings(user: JwtAccessPayload, dto: UpdateMealTimingsDto): Promise<{
        label: string;
        slot: import("./meal-slots").MealSlot;
        start: string;
        end: string;
    }[]>;
    listMenuCategories(user: JwtAccessPayload): Promise<{
        id: string;
        restaurantId: string;
        name: string;
        sortOrder: number;
    }[]>;
    createMenuCategory(user: JwtAccessPayload, dto: CreateMenuCategoryDto): Promise<{
        name: string;
        id: string;
        restaurantId: string;
        sortOrder: number;
    }>;
    updateMenuCategory(user: JwtAccessPayload, id: string, dto: UpdateMenuCategoryDto): Promise<{
        id: string;
        restaurantId: string;
        name: string;
        sortOrder: number;
    }>;
    deleteMenuCategory(user: JwtAccessPayload, id: string): Promise<void>;
    listMenuItems(user: JwtAccessPayload, categoryId?: string): Promise<{
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
        mealSlots: string[] | null;
    }[]>;
    createMenuItem(user: JwtAccessPayload, dto: CreateMenuItemDto): Promise<{
        addons: {
            name: string;
            price: number;
            id: string;
            menuItemId: string;
            isRequired: boolean;
        }[];
        variants: {
            name: string;
            id: string;
            isDefault: boolean;
            menuItemId: string;
            priceDelta: number;
        }[];
        name: string;
        description: string | null;
        price: number;
        imageUrl: string | null;
        isAvailable: boolean;
        isVeg: boolean;
        id: string;
        menuCategoryId: string;
        mealSlots: string[] | null;
    }>;
    updateMenuItem(user: JwtAccessPayload, id: string, dto: UpdateMenuItemDto): Promise<{
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
        mealSlots: string[] | null;
    }>;
    deleteMenuItem(user: JwtAccessPayload, id: string): Promise<void>;
}
