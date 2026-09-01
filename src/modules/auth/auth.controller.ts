import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VendorLoginDto } from './dto/vendor-login.dto';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { ForgotPasswordRequestDto, ForgotPasswordResetDto } from './dto/forgot-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ otpRequest: { limit: 3, ttl: 60_000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone, dto.role);
  }

  @Throttle({ otpVerify: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.role, dto.code, dto.deviceId);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Throttle({ adminLogin: { limit: 10, ttl: 60_000 } })
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  @Throttle({ vendorLogin: { limit: 10, ttl: 60_000 } })
  @Post('vendor/login')
  vendorLogin(@Body() dto: VendorLoginDto) {
    return this.auth.vendorLogin(dto.phone, dto.password, dto.deviceId);
  }

  @Throttle({ vendorLogin: { limit: 10, ttl: 60_000 } })
  @Post('vendor/register')
  vendorRegister(@Body() dto: VendorRegisterDto) {
    return this.auth.vendorRegister(dto);
  }

  @Throttle({ forgotPassword: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password/request')
  forgotPasswordRequest(@Body() dto: ForgotPasswordRequestDto) {
    return this.auth.requestForgotPassword(dto.phone, dto.role ?? 'vendor');
  }

  @Throttle({ forgotPassword: { limit: 10, ttl: 60_000 } })
  @Post('forgot-password/reset')
  forgotPasswordReset(@Body() dto: ForgotPasswordResetDto) {
    return this.auth.resetPasswordWithOtp(dto.phone, dto.code, dto.newPassword, dto.role ?? 'vendor');
  }
}
