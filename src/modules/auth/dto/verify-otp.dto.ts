import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { OTP_ROLES } from '../auth.types';
import type { OtpRole } from '../auth.types';

export class VerifyOtpDto {
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' })
  phone: string;

  @IsEnum(OTP_ROLES)
  role: OtpRole;

  @Matches(/^[0-9]{6}$/, { message: 'code must be a 6-digit number' })
  code: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
