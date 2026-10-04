import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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

  // If set, this coupon only applies to this vendor (null = global coupon)
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  // Person / creator / vendor who owns this coupon and earns commission
  @IsOptional()
  @IsUUID()
  beneficiaryUserId?: string;

  // If false, coupon is hidden from the customer app's public list
  @IsOptional()
  @IsBoolean()
  showInApp?: boolean;

  @IsOptional()
  @IsIn(['percentage', 'flat', 'order_percentage'])
  affiliateCommissionType?: 'percentage' | 'flat' | 'order_percentage';

  @IsOptional()
  @IsNumber()
  @Min(0)
  affiliateCommissionValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTotalUses?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
