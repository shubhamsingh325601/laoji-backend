import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
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
}
