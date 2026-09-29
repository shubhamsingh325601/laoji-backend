import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsIn(['flat', 'percentage', 'free_delivery'])
  discountType: 'flat' | 'percentage' | 'free_delivery';

  @IsNumber()
  @Min(0)
  discountValue: number;

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

  // Valid only on the customer's first N orders; omit for no limit.
  @IsOptional()
  @IsInt()
  @Min(1)
  firstNOrders?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
