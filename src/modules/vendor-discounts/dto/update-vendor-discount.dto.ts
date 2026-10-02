import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateVendorDiscountDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['entire_store', 'product'])
  scope?: 'entire_store' | 'product';

  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @IsOptional()
  @IsUUID()
  menuItemId?: string | null;

  @IsOptional()
  @IsIn(['flat', 'percentage'])
  discountType?: 'flat' | 'percentage';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalUsageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
