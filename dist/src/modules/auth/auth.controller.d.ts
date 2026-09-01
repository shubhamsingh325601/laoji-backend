import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VendorLoginDto } from './dto/vendor-login.dto';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { ForgotPasswordRequestDto, ForgotPasswordResetDto } from './dto/forgot-password.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    requestOtp(dto: RequestOtpDto): Promise<{
        devOtp?: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
    }>;
    refresh(dto: RefreshTokenDto): Promise<import("./auth.types").TokenPair>;
    adminLogin(dto: AdminLoginDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
    }>;
    vendorLogin(dto: VendorLoginDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
        vendor?: any;
    }>;
    vendorRegister(dto: VendorRegisterDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
        vendor: any;
    }>;
    forgotPasswordRequest(dto: ForgotPasswordRequestDto): Promise<{
        message: string;
        devOtp?: string;
    }>;
    forgotPasswordReset(dto: ForgotPasswordResetDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
        message: string;
    }>;
}
