import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class VendorLoginDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone must be a 10-digit number' })
  phone: string;

  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters' })
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
