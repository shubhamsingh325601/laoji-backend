import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
