import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class GroceryOrderLineDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateGroceryOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroceryOrderLineDto)
  items: GroceryOrderLineDto[];

  @IsUUID()
  deliveryAddressId: string;
}
