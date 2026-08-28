export declare class GroceryOrderLineDto {
    productId: string;
    qty: number;
}
export declare class CreateGroceryOrderDto {
    items: GroceryOrderLineDto[];
    deliveryAddressId: string;
    instructions?: string;
}
