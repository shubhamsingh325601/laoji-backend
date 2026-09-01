import { IsIn, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

const VENDOR_TYPES = ['grocery', 'restaurant', 'both'] as const;

export class VendorRegisterDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone must be a 10-digit number' })
  phone: string;

  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters' })
  password: string;

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
