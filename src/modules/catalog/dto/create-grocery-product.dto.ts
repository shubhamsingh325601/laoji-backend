import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateGroceryProductDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsString()
  @Length(1, 50)
  unit: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  stockQty: number;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  offerTag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
