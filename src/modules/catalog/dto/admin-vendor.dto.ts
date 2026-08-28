import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateAdminVendorDto {
  @IsString()
  @Length(2, 200)
  businessName: string;

  @IsString()
  @Length(2, 100)
  ownerName: string;

  @IsString()
  @Length(10, 15)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(['grocery', 'restaurant', 'both'])
  type: 'grocery' | 'restaurant' | 'both';

  @IsOptional()
  @IsString()
  shopAddress?: string;

  @IsOptional()
  @IsNumber()
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  pickupLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  commissionPct?: number;

  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
}

export class UpdateAdminVendorDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['grocery', 'restaurant', 'both'])
  type?: 'grocery' | 'restaurant' | 'both';

  @IsOptional()
  @IsString()
  shopAddress?: string;

  @IsOptional()
  @IsNumber()
  deliveryRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  commissionPct?: number;

  @IsOptional()
  @IsNumber()
  cashbackPct?: number;

  @IsOptional()
  @IsNumber()
  discountPct?: number;

  @IsOptional()
  @IsNumber()
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  maxDiscountCap?: number;

  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';

  @IsOptional()
  @IsIn(['active', 'inactive'])
  activity?: 'active' | 'inactive';
}
