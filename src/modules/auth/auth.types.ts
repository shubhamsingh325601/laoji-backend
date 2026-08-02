// Mirrors the drizzle-orm/pg-core `user_role` enum (drizzle/schema.ts).
export type UserRole = 'customer' | 'vendor' | 'delivery_partner' | 'admin';

// Roles that authenticate via phone+OTP. Admin is excluded — it uses
// email+password (see AuthService.adminLogin) and can never be requested here.
export const OTP_ROLES = ['customer', 'vendor', 'delivery_partner'] as const;
export type OtpRole = (typeof OTP_ROLES)[number];

export interface JwtAccessPayload {
  sub: string; // user id
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string; // user id
  jti: string; // matches an auth_tokens.id row
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
