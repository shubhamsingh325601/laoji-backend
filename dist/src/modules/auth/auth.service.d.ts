import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Db } from '../../config/database.module';
import { OtpRole, TokenPair, UserRole } from './auth.types';
import { VendorRegisterDto } from './dto/vendor-register.dto';
export declare class AuthService {
    private readonly db;
    private readonly jwt;
    private readonly config;
    constructor(db: Db, jwt: JwtService, config: ConfigService);
    requestOtp(phone: string, role: OtpRole): Promise<{
        devOtp?: string;
    }>;
    verifyOtp(phone: string, role: OtpRole, code: string, deviceId?: string): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
    }>;
    adminLogin(email: string, password: string): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
    }>;
    vendorLogin(phone: string, password: string, deviceId?: string): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
        vendor?: any;
    }>;
    vendorRegister(dto: VendorRegisterDto): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
        vendor: any;
    }>;
    requestForgotPassword(phone: string, role?: OtpRole): Promise<{
        message: string;
        devOtp?: string;
    }>;
    resetPasswordWithOtp(phone: string, code: string, newPassword: string, role?: OtpRole): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
        message: string;
    }>;
    refresh(refreshToken: string): Promise<TokenPair>;
    me(userId: string): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        createdAt: Date;
    }>;
    updateEmail(userId: string, email: string): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        createdAt: Date;
    }>;
    private findOrCreateByPhone;
    private issueTokens;
}
