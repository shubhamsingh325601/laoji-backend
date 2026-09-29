import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(['flat', 'percentage', 'free_delivery'])
  discountType?: 'flat' | 'percentage' | 'free_delivery';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFirstOrderOnly?: boolean;

  // null clears the limit.
  @IsOptional()
  @IsInt()
  @Min(1)
  firstNOrders?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
