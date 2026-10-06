import { CreateGroceryOrderDto } from './create-grocery-order.dto';
import { CreateFoodOrderDto } from './create-food-order.dto';
export declare class AdminCreateGroceryOrderDto extends CreateGroceryOrderDto {
    customerId: string;
    paymentMethod: 'cod' | 'paid';
}
export declare class AdminCreateFoodOrderDto extends CreateFoodOrderDto {
    customerId: string;
    paymentMethod: 'cod' | 'paid';
}
