import { IsEnum, Matches } from 'class-validator';
import { OTP_ROLES } from '../auth.types';
import type { OtpRole } from '../auth.types';

export class RequestOtpDto {
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' })
  phone: string;

  @IsEnum(OTP_ROLES)
  role: OtpRole;
}
