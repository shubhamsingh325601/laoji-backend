import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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

  // If set, updates the vendor scope. null clears vendor scope (makes global).
  @IsOptional()
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @IsUUID()
  beneficiaryUserId?: string | null;

  @IsOptional()
  @IsBoolean()
  showInApp?: boolean;

  @IsOptional()
  @IsIn(['percentage', 'flat', 'order_percentage'])
  affiliateCommissionType?: 'percentage' | 'flat' | 'order_percentage' | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  affiliateCommissionValue?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxTotalUses?: number | null;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}
