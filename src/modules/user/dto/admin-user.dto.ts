import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @Length(10, 15)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['customer', 'vendor', 'delivery_partner', 'admin'])
  role?: 'customer' | 'vendor' | 'delivery_partner' | 'admin';

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

export class UpdateAdminUserDto {
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
  @IsIn(['customer', 'vendor', 'delivery_partner', 'admin'])
  role?: 'customer' | 'vendor' | 'delivery_partner' | 'admin';

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsString()
  supportNotes?: string;
}
