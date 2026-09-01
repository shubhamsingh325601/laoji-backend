import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class VendorLoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters' })
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
