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

  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm?: number;
}
