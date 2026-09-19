import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class PartnerLoginDto {
  @IsString()
  @Matches(/^(\+?91|0)?[0-9]{10}$/, { message: 'Phone must be a valid 10-digit mobile number' })
  phone: string;

  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters' })
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class PartnerRegisterDto {
  @IsString()
  @Matches(/^(\+?91|0)?[0-9]{10}$/, { message: 'Phone must be a valid 10-digit mobile number' })
  phone: string;

  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters' })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
