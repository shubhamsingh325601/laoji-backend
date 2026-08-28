export declare class FoodOrderLineDto {
    menuItemId: string;
    qty: number;
    variantId?: string;
    addonIds?: string[];
}
export declare class CreateFoodOrderDto {
    restaurantId: string;
    items: FoodOrderLineDto[];
    deliveryAddressId: string;
    instructions?: string;
}
