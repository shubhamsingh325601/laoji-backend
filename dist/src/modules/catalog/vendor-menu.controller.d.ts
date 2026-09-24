import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { UpdateRestaurantDto } from './dto/restaurant.dto';
import { CreateMenuCategoryDto, CreateMenuItemDto, UpdateMenuCategoryDto, UpdateMenuItemDto } from './dto/menu.dto';
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
    }>;
    updateRestaurant(user: JwtAccessPayload, dto: UpdateRestaurantDto): Promise<{
        id: string;
        vendorId: string;
        name: string;
        cuisineTags: string | null;
        imageUrl: string | null;
        ratingAvg: number;
        isOpen: boolean;
    }>;
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
    }[]>;
    createMenuItem(user: JwtAccessPayload, dto: CreateMenuItemDto): Promise<{
        addons: {
            price: number;
            name: string;
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
        price: number;
        isAvailable: boolean;
        name: string;
        imageUrl: string | null;
        description: string | null;
        id: string;
        menuCategoryId: string;
        isVeg: boolean;
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
    }>;
    deleteMenuItem(user: JwtAccessPayload, id: string): Promise<void>;
}
