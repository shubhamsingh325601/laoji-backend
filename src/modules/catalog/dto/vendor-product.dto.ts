import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class UpsertVendorProductDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  stockQty: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  offerTag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

export class UpdateVendorProductDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  offerTag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
