import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VendorLoginDto } from './dto/vendor-login.dto';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { CustomerLoginDto, CustomerRegisterDto } from './dto/customer-auth.dto';
import { ForgotPasswordRequestDto, ForgotPasswordResetDto } from './dto/forgot-password.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import type { JwtAccessPayload } from './auth.types';
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
    customerLogin(dto: CustomerLoginDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
        user: any;
    }>;
    customerRegister(dto: CustomerRegisterDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
        user: any;
    }>;
    adminLogin(dto: AdminLoginDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
    }>;
    vendorLogin(dto: VendorLoginDto): Promise<{
        tokens: import("./auth.types").TokenPair;
        userId: string;
        role: import("./auth.types").UserRole;
        mustChangePassword: boolean;
        vendor?: any;
    }>;
    vendorCreatePassword(user: JwtAccessPayload, dto: CreatePasswordDto): Promise<{
        success: boolean;
        message: string;
        mustChangePassword: boolean;
    }>;
    changePassword(user: JwtAccessPayload, dto: CreatePasswordDto): Promise<{
        success: boolean;
        message: string;
        mustChangePassword: boolean;
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
