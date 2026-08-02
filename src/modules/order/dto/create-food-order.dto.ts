import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class FoodOrderLineDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  addonIds?: string[];
}

export class CreateFoodOrderDto {
  @IsUUID()
  restaurantId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodOrderLineDto)
  items: FoodOrderLineDto[];

  @IsUUID()
  deliveryAddressId: string;
}
