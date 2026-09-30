import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  subtotal: number;

  // If provided, the coupon must be valid for this vendor (global coupons
  // have vendorId = null and will be rejected if a vendorId is specified
  // and doesn't match).
  @IsOptional()
  @IsUUID()
  vendorId?: string;
}
