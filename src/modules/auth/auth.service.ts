import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'crypto';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { authTokens, otpCodes, users } from '../../../drizzle/schema';
import { parseDurationMs } from '../../common/utils/duration';
import { JwtAccessPayload, JwtRefreshPayload, OtpRole, TokenPair, UserRole } from './auth.types';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(phone: string, role: OtpRole): Promise<{ devOtp?: string }> {
    // Test mode: a fixed 123456 OTP is issued whenever not running in
    // production, or when OTP_TEST_MODE=true is explicitly set on the
    // deployed service. Keeps logins reproducible across the mobile apps
    // (see CLAUDE.md OTP-delivery note); production without the flag stays
    // random, like real SMS OTPs will be.
    const testMode =
      this.config.get<string>('NODE_ENV') !== 'production' ||
      this.config.get<boolean>('OTP_TEST_MODE') === true;
    const code = testMode ? '123456' : String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);

    await this.db.insert(otpCodes).values({
      phone,
      purpose: `login:${role}`,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    // Dev-mode stub: no SMS provider wired yet (see CLAUDE.md OTP-delivery note).
    // The OTP is only ever returned in the API response outside production.
    return testMode ? { devOtp: code } : {};
  }

  async verifyOtp(
    phone: string,
    role: OtpRole,
    code: string,
    deviceId?: string,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole }> {
    const [otp] = await this.db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, phone),
          eq(otpCodes.purpose, `login:${role}`),
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!otp) {
      throw new BadRequestException('OTP expired or not found — request a new one');
    }
    if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts — request a new OTP');
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      await this.db
        .update(otpCodes)
        .set({ attemptCount: otp.attemptCount + 1 })
        .where(eq(otpCodes.id, otp.id));
      throw new BadRequestException('Incorrect OTP');
    }

    await this.db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));

    const user = await this.findOrCreateByPhone(phone, role);
    const tokens = await this.issueTokens(user.id, user.role, deviceId);
    return { tokens, userId: user.id, role: user.role };
  }

  async adminLogin(
    email: string,
    password: string,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.role, 'admin')))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.role);
    return { tokens, userId: user.id, role: user.role };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwt.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const [row] = await this.db
      .select()
      .from(authTokens)
      .where(eq(authTokens.id, payload.jti))
      .limit(1);

    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (row.revokedAt) {
      // Reuse of an already-rotated refresh token — treat as theft, kill every
      // session for this user (TRD Section 10: "detect reuse = revoke session").
      await this.db
        .update(authTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(authTokens.userId, row.userId), isNull(authTokens.revokedAt)));
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    const hash = hashToken(refreshToken);
    if (hash !== row.refreshTokenHash) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    await this.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(eq(authTokens.id, row.id));

    return this.issueTokens(user.id, user.role, row.deviceId ?? undefined);
  }

  async me(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // No profile-edit endpoint existed anywhere — phone+OTP accounts
  // (customer/vendor/delivery_partner) never had a way to add an email at
  // all. Added as a Phase 7 prerequisite: email notifications (receipts,
  // KYC status) need somewhere real to send to for these roles, not just
  // admin's email+password login.
  async updateEmail(userId: string, email: string) {
    const [existing] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing && existing.id !== userId) {
      throw new ConflictException('This email is already in use by another account');
    }

    const [user] = await this.db.update(users).set({ email }).where(eq(users.id, userId)).returning();
    if (!user) throw new UnauthorizedException('User no longer exists');
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private async findOrCreateByPhone(phone: string, role: OtpRole) {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), eq(users.role, role)))
      .limit(1);
    if (existing) return existing;

    try {
      const [created] = await this.db.insert(users).values({ phone, role }).returning();
      return created;
    } catch {
      throw new ConflictException('Account creation conflict — try again');
    }
  }

  private async issueTokens(
    userId: string,
    role: UserRole,
    deviceId?: string,
  ): Promise<TokenPair> {
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN')!;
    const accessPayload: JwtAccessPayload = { sub: userId, role };
    const accessToken = this.jwt.sign(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: parseDurationMs(accessExpiresIn) / 1000,
    });

    const jti = randomUUID();
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN')!;
    const refreshPayload: JwtRefreshPayload = { sub: userId, jti };
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: parseDurationMs(refreshExpiresIn) / 1000,
    });

    await this.db.insert(authTokens).values({
      id: jti,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      deviceId,
      expiresAt: new Date(Date.now() + parseDurationMs(refreshExpiresIn)),
    });

    return { accessToken, refreshToken };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
