import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone must be a 10-digit number' })
  phone: string;

  @IsOptional()
  @IsIn(['vendor', 'customer', 'delivery_partner'])
  role?: 'vendor' | 'customer' | 'delivery_partner';
}

export class ForgotPasswordResetDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Phone must be a 10-digit number' })
  phone: string;

  @IsString()
  @Length(4, 10)
  code: string;

  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters' })
  newPassword: string;

  @IsOptional()
  @IsIn(['vendor', 'customer', 'delivery_partner'])
  role?: 'vendor' | 'customer' | 'delivery_partner';
}
