import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

const VENDOR_TYPES = ['grocery', 'restaurant', 'both'] as const;

export class UpsertVendorProfileDto {
  @IsString()
  @Length(1, 200)
  businessName: string;

  @IsString()
  @Length(1, 200)
  ownerName: string;

  @IsIn(VENDOR_TYPES)
  type: (typeof VENDOR_TYPES)[number];

  @IsOptional()
  @IsString()
  shopAddress?: string;

  // Required when the profile is first created; on later edits, omitting
  // them keeps the stored pickup point (PATCH /vendors/me/location moves it).
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  businessType?: string;
}

export class UpdateVendorLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;
}
