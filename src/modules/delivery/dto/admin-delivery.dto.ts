import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreateAdminDeliveryPartnerDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsString()
  @Length(10, 15)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(['bike', 'scooter', 'bicycle'])
  vehicleType: 'bike' | 'scooter' | 'bicycle';

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
}

export class UpdateAdminDeliveryPartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['bike', 'scooter', 'bicycle'])
  vehicleType?: 'bike' | 'scooter' | 'bicycle';

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified', 'rejected'])
  kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  isAvailable?: boolean;
}
