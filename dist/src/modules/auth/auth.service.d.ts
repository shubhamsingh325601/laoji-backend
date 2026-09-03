import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Db } from '../../config/database.module';
import { OtpRole, TokenPair, UserRole } from './auth.types';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { CustomerRegisterDto } from './dto/customer-auth.dto';
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
    customerLogin(phone: string, password: string, deviceId?: string): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
        user: any;
    }>;
    customerRegister(dto: CustomerRegisterDto): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
        user: any;
    }>;
    vendorLogin(identifier: {
        email?: string;
        phone?: string;
    } | string, password: string, deviceId?: string): Promise<{
        tokens: TokenPair;
        userId: string;
        role: UserRole;
        mustChangePassword: boolean;
        vendor?: any;
    }>;
    createPassword(userId: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
        mustChangePassword: boolean;
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
        name: string | null;
        city: string | null;
        timezone: string | null;
        notifyStuckOrders: boolean;
        notifyKyc: boolean;
        supportNotes: string | null;
        mustChangePassword: boolean;
        createdAt: Date;
    }>;
    updateEmail(userId: string, email: string): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        name: string | null;
        city: string | null;
        timezone: string | null;
        notifyStuckOrders: boolean;
        notifyKyc: boolean;
        supportNotes: string | null;
        mustChangePassword: boolean;
        createdAt: Date;
    }>;
    updateProfile(userId: string, dto: {
        name?: string;
        email?: string;
    }): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        name: string | null;
        city: string | null;
        timezone: string | null;
        notifyStuckOrders: boolean;
        notifyKyc: boolean;
        supportNotes: string | null;
        mustChangePassword: boolean;
        createdAt: Date;
    }>;
    deleteAccount(userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private findOrCreateByPhone;
    private issueTokens;
}
