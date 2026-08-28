export type UserRole = 'customer' | 'vendor' | 'delivery_partner' | 'admin';
export declare const OTP_ROLES: readonly ["customer", "vendor", "delivery_partner"];
export type OtpRole = (typeof OTP_ROLES)[number];
export interface JwtAccessPayload {
    sub: string;
    role: UserRole;
}
export interface JwtRefreshPayload {
    sub: string;
    jti: string;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
