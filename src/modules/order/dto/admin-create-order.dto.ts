import { IsIn, IsUUID } from 'class-validator';
import { CreateGroceryOrderDto } from './create-grocery-order.dto';
import { CreateFoodOrderDto } from './create-food-order.dto';

// Admin placing an order on behalf of a customer. 'cod' = cash on delivery;
// 'paid' = payment already received and confirmed by the admin.
export class AdminCreateGroceryOrderDto extends CreateGroceryOrderDto {
  @IsUUID()
  customerId: string;

  @IsIn(['cod', 'paid'])
  paymentMethod: 'cod' | 'paid';
}

export class AdminCreateFoodOrderDto extends CreateFoodOrderDto {
  @IsUUID()
  customerId: string;

  @IsIn(['cod', 'paid'])
  paymentMethod: 'cod' | 'paid';
}
