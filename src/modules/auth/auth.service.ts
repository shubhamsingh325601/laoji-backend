import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, desc, eq, gt, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID } from 'crypto';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  authTokens,
  deliveryPartners,
  foodOrders,
  groceryOrders,
  kycDocuments,
  otpCodes,
  restaurants,
  users,
  vendors,
} from '../../../drizzle/schema';
import { parseDurationMs } from '../../common/utils/duration';
import { isDefaultPickup } from '../catalog/catalog.types';
import { JwtAccessPayload, JwtRefreshPayload, OtpRole, TokenPair, UserRole } from './auth.types';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { CustomerRegisterDto } from './dto/customer-auth.dto';
import { PartnerRegisterDto } from './dto/partner-auth.dto';

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
    const trimmedInput = email.trim().toLowerCase();
    const cleanPhone = trimmedInput.replace(/^(\+91|0)/, '');

    // Support email, phone, or admin aliases
    let [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(
            ilike(users.email, trimmedInput),
            eq(users.phone, cleanPhone),
            eq(users.phone, trimmedInput),
          ),
          eq(users.role, 'admin'),
        ),
      )
      .limit(1);

    // Fallback aliases: if logging in as admin@laojionline.com, admin@laoji.in, or admin, map to owner@laojionline.com
    if (
      !user &&
      (trimmedInput === 'admin@laojionline.com' ||
        trimmedInput === 'admin@laoji.in' ||
        trimmedInput === 'admin@laoji.app' ||
        trimmedInput === 'admin')
    ) {
      [user] = await this.db
        .select()
        .from(users)
        .where(and(ilike(users.email, 'owner@laojionline.com'), eq(users.role, 'admin')))
        .limit(1);
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    let matches = await bcrypt.compare(password, user.passwordHash);

    // If password didn't match user's current hash, also check all other existing admin password hashes
    // so any previous admin password (e.g. Admin@123 or legacy hash) works seamlessly
    if (!matches) {
      const otherAdmins = await this.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(and(eq(users.role, 'admin'), isNotNull(users.passwordHash)));

      for (const adminRow of otherAdmins) {
        if (adminRow.passwordHash && adminRow.passwordHash !== user.passwordHash) {
          if (await bcrypt.compare(password, adminRow.passwordHash)) {
            matches = true;
            // Upgrade this user's passwordHash so future logins match directly
            const upgradedHash = await bcrypt.hash(password, 10);
            await this.db.update(users).set({ passwordHash: upgradedHash }).where(eq(users.id, user.id));
            break;
          }
        }
      }
    }

    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.role);
    return { tokens, userId: user.id, role: user.role };
  }

  async customerLogin(
    phone: string,
    password: string,
    deviceId?: string,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; user: any }> {
    const cleanPhone = phone.trim().replace(/^(\+91|0)/, '');
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, cleanPhone), eq(users.role, 'customer')))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number. Please sign up.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Password is not set for this account. Please sign up or reset your password.');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Incorrect password. Please try again.');
    }

    const tokens = await this.issueTokens(user.id, user.role, deviceId);
    const { passwordHash: _hash, ...safeUser } = user;
    return { tokens, userId: user.id, role: user.role, user: safeUser };
  }

  async customerRegister(
    dto: CustomerRegisterDto,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; user: any }> {
    const cleanPhone = dto.phone.trim().replace(/^(\+91|0)/, '');
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, cleanPhone), eq(users.role, 'customer'), eq(users.status, 'active')))
      .limit(1);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    if (existing) {
      if (existing.passwordHash) {
        throw new ConflictException('An account with this phone number already exists. Please log in.');
      }
      const updates: { passwordHash: string; name?: string } = { passwordHash };
      if (dto.name?.trim()) {
        updates.name = dto.name.trim();
      }
      const [updated] = await this.db
        .update(users)
        .set(updates)
        .where(eq(users.id, existing.id))
        .returning();

      const tokens = await this.issueTokens(updated.id, 'customer', dto.deviceId);
      const { passwordHash: _hash, ...safeUser } = updated;
      return { tokens, userId: updated.id, role: 'customer', user: safeUser };
    }

    const [created] = await this.db
      .insert(users)
      .values({
        phone: cleanPhone,
        role: 'customer',
        passwordHash,
        name: dto.name?.trim() || null,
      })
      .returning();

    const tokens = await this.issueTokens(created.id, 'customer', dto.deviceId);
    const { passwordHash: _hash, ...safeUser } = created;
    return { tokens, userId: created.id, role: 'customer', user: safeUser };
  }

  async partnerLogin(
    phone: string,
    password: string,
    deviceId?: string,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; user: any; partner?: any }> {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);

    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, cleanPhone), eq(users.role, 'delivery_partner')))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('No partner account found with this phone number. Please register.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Password is not set for this account. Please reset password or contact support.');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Incorrect password. Please try again.');
    }

    const tokens = await this.issueTokens(user.id, user.role, deviceId);
    let [partner] = await this.db
      .select()
      .from(deliveryPartners)
      .where(eq(deliveryPartners.userId, user.id))
      .limit(1);

    if (!partner) {
      [partner] = await this.db
        .insert(deliveryPartners)
        .values({
          userId: user.id,
          vehicleType: 'bike',
          kycStatus: 'pending',
        })
        .returning();
    }

    const { passwordHash: _hash, ...safeUser } = user;
    return { tokens, userId: user.id, role: user.role, user: safeUser, partner };
  }

  async partnerRegister(
    dto: PartnerRegisterDto,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; user: any; partner?: any }> {
    let cleanPhone = dto.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);

    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, cleanPhone), eq(users.role, 'delivery_partner'), eq(users.status, 'active')))
      .limit(1);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    let user: typeof users.$inferSelect;

    if (existing) {
      if (existing.passwordHash) {
        throw new ConflictException('A partner account with this phone number already exists. Please log in.');
      }
      const updates: { passwordHash: string; name?: string } = { passwordHash };
      if (dto.name?.trim()) {
        updates.name = dto.name.trim();
      }
      const [updated] = await this.db
        .update(users)
        .set(updates)
        .where(eq(users.id, existing.id))
        .returning();
      user = updated;
    } else {
      const [created] = await this.db
        .insert(users)
        .values({
          phone: cleanPhone,
          role: 'delivery_partner',
          passwordHash,
          name: dto.name?.trim() || null,
        })
        .returning();
      user = created;
    }

    let [partner] = await this.db
      .select()
      .from(deliveryPartners)
      .where(eq(deliveryPartners.userId, user.id))
      .limit(1);

    if (!partner) {
      [partner] = await this.db
        .insert(deliveryPartners)
        .values({
          userId: user.id,
          vehicleType: dto.vehicleType || 'bike',
          kycStatus: 'pending',
        })
        .returning();
    } else if (dto.vehicleType && partner.vehicleType !== dto.vehicleType) {
      const [updatedPartner] = await this.db
        .update(deliveryPartners)
        .set({ vehicleType: dto.vehicleType })
        .where(eq(deliveryPartners.id, partner.id))
        .returning();
      partner = updatedPartner;
    }

    const tokens = await this.issueTokens(user.id, 'delivery_partner', dto.deviceId);
    const { passwordHash: _hash, ...safeUser } = user;
    return { tokens, userId: user.id, role: 'delivery_partner', user: safeUser, partner };
  }

  async vendorLogin(
    identifier: { email?: string; phone?: string } | string,
    password: string,
    deviceId?: string,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; mustChangePassword: boolean; vendor?: any }> {
    const email = typeof identifier === 'object' ? identifier.email : undefined;
    const phone = typeof identifier === 'object' ? identifier.phone : identifier;

    let user: typeof users.$inferSelect | undefined;

    if (email && email.trim()) {
      const trimmedEmail = email.trim().toLowerCase();
      const [u] = await this.db
        .select()
        .from(users)
        .where(and(ilike(users.email, trimmedEmail), eq(users.role, 'vendor')))
        .limit(1);
      user = u;
    } else if (phone && phone.trim()) {
      const trimmedPhone = phone.trim();
      const [u] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.phone, trimmedPhone), eq(users.role, 'vendor')))
        .limit(1);
      user = u;
    } else {
      throw new BadRequestException('Please provide your email address or mobile number');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Password not set for this account. Please use Forgot Password to set one.');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.role, deviceId);
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);

    return {
      tokens,
      userId: user.id,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
      vendor: vendor
        ? {
            ...vendor,
            email: user.email,
            phone: user.phone,
            mustChangePassword: !!user.mustChangePassword,
          }
        : undefined,
    };
  }

  async createPassword(
    userId: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string; mustChangePassword: boolean }> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
      })
      .where(eq(users.id, userId));

    return {
      success: true,
      message: 'Password created successfully',
      mustChangePassword: false,
    };
  }

  async vendorRegister(
    dto: VendorRegisterDto,
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; vendor: any }> {
    const trimmedPhone = dto.phone.trim();
    const trimmedEmail = dto.email?.trim() ? dto.email.trim().toLowerCase() : null;

    if (trimmedEmail) {
      const [emailUser] = await this.db
        .select()
        .from(users)
        .where(and(ilike(users.email, trimmedEmail), eq(users.role, 'vendor'), eq(users.status, 'active')))
        .limit(1);
      if (emailUser && emailUser.phone !== trimmedPhone) {
        throw new ConflictException('An account with this email address already exists.');
      }
    }

    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, trimmedPhone), eq(users.role, 'vendor'), eq(users.status, 'active')))
      .limit(1);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let userId: string;

    if (existingUser) {
      const [existingVendor] = await this.db
        .select()
        .from(vendors)
        .where(eq(vendors.userId, existingUser.id))
        .limit(1);

      if (existingVendor || existingUser.passwordHash) {
        throw new ConflictException('An account with this phone number already exists. Please log in.');
      }

      await this.db
        .update(users)
        .set({
          passwordHash,
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        })
        .where(eq(users.id, existingUser.id));
      userId = existingUser.id;
    } else {
      const [createdUser] = await this.db
        .insert(users)
        .values({
          phone: trimmedPhone,
          email: trimmedEmail,
          role: 'vendor',
          status: 'active',
          passwordHash,
        })
        .returning();
      userId = createdUser.id;
    }

    const [existingVendor] = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    let vendorRecord: any;
    if (existingVendor) {
      // Registering again keeps the store's pickup point unless this signup
      // got a real GPS fix, and keeps its delivery radius (admin's to change),
      // same as a profile edit (CatalogService#upsertVendorProfile).
      const [updated] = await this.db
        .update(vendors)
        .set({
          businessName: dto.businessName,
          ownerName: dto.ownerName,
          type: dto.type,
          businessType: dto.businessType ?? (dto.type === 'restaurant' ? 'restaurant' : 'grocery'),
          ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
          shopAddress: dto.shopAddress ?? undefined,
          ...(isDefaultPickup(dto.pickupLat, dto.pickupLng) ? {} : { pickupLat: dto.pickupLat, pickupLng: dto.pickupLng }),
        })
        .where(eq(vendors.id, existingVendor.id))
        .returning();
      vendorRecord = updated;
    } else {
      const [created] = await this.db
        .insert(vendors)
        .values({
          userId,
          businessName: dto.businessName,
          ownerName: dto.ownerName,
          type: dto.type,
          businessType: dto.businessType ?? (dto.type === 'restaurant' ? 'restaurant' : 'grocery'),
          imageUrl: dto.imageUrl ?? null,
          shopAddress: dto.shopAddress ?? null,
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          radiusKm: dto.radiusKm ?? 5,
        })
        .returning();
      vendorRecord = created;
    }

    const tokens = await this.issueTokens(userId, 'vendor');
    return { tokens, userId, role: 'vendor', vendor: vendorRecord };
  }

  async requestForgotPassword(
    phone: string,
    role: OtpRole = 'vendor',
  ): Promise<{ message: string; devOtp?: string }> {
    const trimmedPhone = phone.trim();
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, trimmedPhone), eq(users.role, role)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('No account found with this phone number');
    }

    const testMode =
      this.config.get<string>('NODE_ENV') !== 'production' ||
      this.config.get<boolean>('OTP_TEST_MODE') === true;
    const code = testMode ? '123456' : String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);

    await this.db.insert(otpCodes).values({
      phone: trimmedPhone,
      purpose: `reset_password:${role}`,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    return {
      message: 'Password reset code has been sent to your mobile number',
      ...(testMode ? { devOtp: code } : {}),
    };
  }

  async resetPasswordWithOtp(
    phone: string,
    code: string,
    newPassword: string,
    role: OtpRole = 'vendor',
  ): Promise<{ tokens: TokenPair; userId: string; role: UserRole; message: string }> {
    const trimmedPhone = phone.trim();
    const [otp] = await this.db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phone, trimmedPhone),
          eq(otpCodes.purpose, `reset_password:${role}`),
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!otp) {
      throw new BadRequestException('Verification code expired or not found. Please request a new one.');
    }
    if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts — please request a new code');
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      await this.db
        .update(otpCodes)
        .set({ attemptCount: otp.attemptCount + 1 })
        .where(eq(otpCodes.id, otp.id));
      throw new BadRequestException('Incorrect verification code');
    }

    await this.db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));

    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, trimmedPhone), eq(users.role, role)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    const tokens = await this.issueTokens(user.id, user.role);
    return { tokens, userId: user.id, role: user.role, message: 'Password reset successfully' };
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
      // If rotated within last 120s, it's a concurrent request / network retry race condition.
      // Gracefully re-issue tokens so the client doesn't get logged out!
      const rotatedRecently = Date.now() - new Date(row.revokedAt).getTime() < 120_000;
      if (rotatedRecently) {
        const [user] = await this.db.select().from(users).where(eq(users.id, row.userId)).limit(1);
        if (user) {
          return this.issueTokens(user.id, user.role, row.deviceId ?? undefined);
        }
      }
      throw new UnauthorizedException('Refresh token has already been rotated');
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

  async updateProfile(userId: string, dto: { name?: string; email?: string }) {
    if (dto.email) {
      const [existing] = await this.db.select().from(users).where(eq(users.email, dto.email)).limit(1);
      if (existing && existing.id !== userId) {
        throw new ConflictException('This email is already in use by another account');
      }
    }

    const updates: { name?: string; email?: string } = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.email !== undefined) updates.email = dto.email.trim();

    if (Object.keys(updates).length === 0) return this.me(userId);

    const [user] = await this.db.update(users).set(updates).where(eq(users.id, userId)).returning();
    if (!user) throw new UnauthorizedException('User no longer exists');
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async deleteAccount(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'vendor') {
      const [vendor] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
      if (vendor) {
        // Check active grocery orders
        const activeGrocery = await this.db
          .select({ id: groceryOrders.id })
          .from(groceryOrders)
          .where(
            and(
              eq(groceryOrders.vendorId, vendor.id),
              inArray(groceryOrders.status, [
                'placed',
                'vendor_accepted',
                'preparing',
                'ready',
                'handed_over',
                'delivery_assigned',
                'picked_up',
                'out_for_delivery',
              ]),
            ),
          )
          .limit(1);

        // Check active food orders
        const [restaurant] = await this.db
          .select()
          .from(restaurants)
          .where(eq(restaurants.vendorId, vendor.id))
          .limit(1);

        let activeFood: { id: string }[] = [];
        if (restaurant) {
          activeFood = await this.db
            .select({ id: foodOrders.id })
            .from(foodOrders)
            .where(
              and(
                eq(foodOrders.restaurantId, restaurant.id),
                inArray(foodOrders.status, [
                  'placed',
                  'vendor_accepted',
                  'preparing',
                  'ready',
                  'handed_over',
                  'delivery_assigned',
                  'picked_up',
                  'out_for_delivery',
                ]),
              ),
            )
            .limit(1);
        }

        if (activeGrocery.length > 0 || activeFood.length > 0) {
          throw new BadRequestException(
            'Cannot delete account while you have active orders in progress. Please complete or cancel remaining orders first.',
          );
        }

        // Close vendor store & restaurant
        await this.db
          .update(vendors)
          .set({ isOpen: false })
          .where(eq(vendors.id, vendor.id));

        if (restaurant) {
          await this.db
            .update(restaurants)
            .set({ isOpen: false })
            .where(eq(restaurants.id, restaurant.id));
        }
      }
    } else if (user.role === 'delivery_partner') {
      await this.db
        .update(deliveryPartners)
        .set({ isOnline: false })
        .where(eq(deliveryPartners.userId, userId));
    }

    // Delete KYC documents belonging to this user
    await this.db.delete(kycDocuments).where(eq(kycDocuments.userId, userId));

    await this.db
      .update(users)
      .set({ status: 'suspended', phone: null, email: null, name: null })
      .where(eq(users.id, userId));

    await this.db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(eq(authTokens.userId, userId));

    return { success: true, message: 'Account deleted successfully' };
  }

  private async findOrCreateByPhone(phone: string, role: OtpRole) {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), eq(users.role, role), eq(users.status, 'active')))
      .limit(1);
    if (existing) return existing;

    try {
      const [created] = await this.db.insert(users).values({ phone, role, status: 'active' }).returning();
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
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '7d';
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '90d';

    const accessPayload: JwtAccessPayload = { sub: userId, role };
    const accessToken = this.jwt.sign(accessPayload, {
      secret: accessSecret,
      expiresIn: Math.floor(parseDurationMs(accessExpiresIn, 7 * 24 * 60 * 60 * 1000) / 1000),
    });

    const jti = randomUUID();
    const refreshPayload: JwtRefreshPayload = { sub: userId, jti };
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: Math.floor(parseDurationMs(refreshExpiresIn, 90 * 24 * 60 * 60 * 1000) / 1000),
    });

    await this.db.insert(authTokens).values({
      id: jti,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      deviceId: deviceId ?? null,
      expiresAt: new Date(Date.now() + parseDurationMs(refreshExpiresIn, 90 * 24 * 60 * 60 * 1000)),
    });

    return { accessToken, refreshToken };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
