"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const drizzle_orm_1 = require("drizzle-orm");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const duration_1 = require("../../common/utils/duration");
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
let AuthService = class AuthService {
    db;
    jwt;
    config;
    constructor(db, jwt, config) {
        this.db = db;
        this.jwt = jwt;
        this.config = config;
    }
    async requestOtp(phone, role) {
        const testMode = this.config.get('NODE_ENV') !== 'production' ||
            this.config.get('OTP_TEST_MODE') === true;
        const code = testMode ? '123456' : String((0, crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
        const codeHash = await bcrypt.hash(code, 10);
        await this.db.insert(schema_1.otpCodes).values({
            phone,
            purpose: `login:${role}`,
            codeHash,
            expiresAt: new Date(Date.now() + OTP_TTL_MS),
        });
        return testMode ? { devOtp: code } : {};
    }
    async verifyOtp(phone, role, code, deviceId) {
        const [otp] = await this.db
            .select()
            .from(schema_1.otpCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.otpCodes.phone, phone), (0, drizzle_orm_1.eq)(schema_1.otpCodes.purpose, `login:${role}`), (0, drizzle_orm_1.isNull)(schema_1.otpCodes.consumedAt), (0, drizzle_orm_1.gt)(schema_1.otpCodes.expiresAt, new Date())))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.otpCodes.createdAt))
            .limit(1);
        if (!otp) {
            throw new common_1.BadRequestException('OTP expired or not found — request a new one');
        }
        if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
            throw new common_1.BadRequestException('Too many incorrect attempts — request a new OTP');
        }
        const matches = await bcrypt.compare(code, otp.codeHash);
        if (!matches) {
            await this.db
                .update(schema_1.otpCodes)
                .set({ attemptCount: otp.attemptCount + 1 })
                .where((0, drizzle_orm_1.eq)(schema_1.otpCodes.id, otp.id));
            throw new common_1.BadRequestException('Incorrect OTP');
        }
        await this.db.update(schema_1.otpCodes).set({ consumedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.otpCodes.id, otp.id));
        const user = await this.findOrCreateByPhone(phone, role);
        const tokens = await this.issueTokens(user.id, user.role, deviceId);
        return { tokens, userId: user.id, role: user.role };
    }
    async adminLogin(email, password) {
        const trimmedEmail = email.trim();
        const [user] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.ilike)(schema_1.users.email, trimmedEmail), (0, drizzle_orm_1.eq)(schema_1.users.role, 'admin')))
            .limit(1);
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const tokens = await this.issueTokens(user.id, user.role);
        return { tokens, userId: user.id, role: user.role };
    }
    async vendorLogin(identifier, password, deviceId) {
        const email = typeof identifier === 'object' ? identifier.email : undefined;
        const phone = typeof identifier === 'object' ? identifier.phone : identifier;
        let user;
        if (email && email.trim()) {
            const trimmedEmail = email.trim().toLowerCase();
            const [u] = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.ilike)(schema_1.users.email, trimmedEmail), (0, drizzle_orm_1.eq)(schema_1.users.role, 'vendor')))
                .limit(1);
            user = u;
        }
        else if (phone && phone.trim()) {
            const trimmedPhone = phone.trim();
            const [u] = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.users.role, 'vendor')))
                .limit(1);
            user = u;
        }
        else {
            throw new common_1.BadRequestException('Please provide your email address or mobile number');
        }
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        if (!user.passwordHash) {
            throw new common_1.UnauthorizedException('Password not set for this account. Please use Forgot Password to set one.');
        }
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const tokens = await this.issueTokens(user.id, user.role, deviceId);
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, user.id)).limit(1);
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
    async createPassword(userId, newPassword) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user) {
            throw new common_1.NotFoundException('User account not found');
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.db
            .update(schema_1.users)
            .set({
            passwordHash,
            mustChangePassword: false,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        return {
            success: true,
            message: 'Password created successfully',
            mustChangePassword: false,
        };
    }
    async vendorRegister(dto) {
        const trimmedPhone = dto.phone.trim();
        const [existingUser] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.users.role, 'vendor')))
            .limit(1);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        let userId;
        if (existingUser) {
            const [existingVendor] = await this.db
                .select()
                .from(schema_1.vendors)
                .where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, existingUser.id))
                .limit(1);
            if (existingVendor && existingUser.passwordHash) {
                throw new common_1.ConflictException('An account with this phone number already exists. Please log in.');
            }
            await this.db
                .update(schema_1.users)
                .set({ passwordHash })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, existingUser.id));
            userId = existingUser.id;
        }
        else {
            const [createdUser] = await this.db
                .insert(schema_1.users)
                .values({
                phone: trimmedPhone,
                role: 'vendor',
                passwordHash,
            })
                .returning();
            userId = createdUser.id;
        }
        const [existingVendor] = await this.db
            .select()
            .from(schema_1.vendors)
            .where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId))
            .limit(1);
        let vendorRecord;
        if (existingVendor) {
            const [updated] = await this.db
                .update(schema_1.vendors)
                .set({
                businessName: dto.businessName,
                ownerName: dto.ownerName,
                type: dto.type,
                shopAddress: dto.shopAddress ?? undefined,
                pickupLat: dto.pickupLat,
                pickupLng: dto.pickupLng,
                radiusKm: dto.radiusKm ?? 5,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, existingVendor.id))
                .returning();
            vendorRecord = updated;
        }
        else {
            const [created] = await this.db
                .insert(schema_1.vendors)
                .values({
                userId,
                businessName: dto.businessName,
                ownerName: dto.ownerName,
                type: dto.type,
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
    async requestForgotPassword(phone, role = 'vendor') {
        const trimmedPhone = phone.trim();
        const [user] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.users.role, role)))
            .limit(1);
        if (!user) {
            throw new common_1.NotFoundException('No account found with this phone number');
        }
        const testMode = this.config.get('NODE_ENV') !== 'production' ||
            this.config.get('OTP_TEST_MODE') === true;
        const code = testMode ? '123456' : String((0, crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
        const codeHash = await bcrypt.hash(code, 10);
        await this.db.insert(schema_1.otpCodes).values({
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
    async resetPasswordWithOtp(phone, code, newPassword, role = 'vendor') {
        const trimmedPhone = phone.trim();
        const [otp] = await this.db
            .select()
            .from(schema_1.otpCodes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.otpCodes.phone, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.otpCodes.purpose, `reset_password:${role}`), (0, drizzle_orm_1.isNull)(schema_1.otpCodes.consumedAt), (0, drizzle_orm_1.gt)(schema_1.otpCodes.expiresAt, new Date())))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.otpCodes.createdAt))
            .limit(1);
        if (!otp) {
            throw new common_1.BadRequestException('Verification code expired or not found. Please request a new one.');
        }
        if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
            throw new common_1.BadRequestException('Too many incorrect attempts — please request a new code');
        }
        const matches = await bcrypt.compare(code, otp.codeHash);
        if (!matches) {
            await this.db
                .update(schema_1.otpCodes)
                .set({ attemptCount: otp.attemptCount + 1 })
                .where((0, drizzle_orm_1.eq)(schema_1.otpCodes.id, otp.id));
            throw new common_1.BadRequestException('Incorrect verification code');
        }
        await this.db.update(schema_1.otpCodes).set({ consumedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.otpCodes.id, otp.id));
        const [user] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.users.role, role)))
            .limit(1);
        if (!user) {
            throw new common_1.NotFoundException('User account not found');
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.db.update(schema_1.users).set({ passwordHash }).where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id));
        const tokens = await this.issueTokens(user.id, user.role);
        return { tokens, userId: user.id, role: user.role, message: 'Password reset successfully' };
    }
    async refresh(refreshToken) {
        let payload;
        try {
            payload = this.jwt.verify(refreshToken, {
                secret: this.config.get('JWT_REFRESH_SECRET'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        const [row] = await this.db
            .select()
            .from(schema_1.authTokens)
            .where((0, drizzle_orm_1.eq)(schema_1.authTokens.id, payload.jti))
            .limit(1);
        if (!row || row.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        if (row.revokedAt) {
            await this.db
                .update(schema_1.authTokens)
                .set({ revokedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.authTokens.userId, row.userId), (0, drizzle_orm_1.isNull)(schema_1.authTokens.revokedAt)));
            throw new common_1.UnauthorizedException('Refresh token reuse detected — all sessions revoked');
        }
        const hash = hashToken(refreshToken);
        if (hash !== row.refreshTokenHash) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, row.userId)).limit(1);
        if (!user) {
            throw new common_1.UnauthorizedException('User no longer exists');
        }
        await this.db
            .update(schema_1.authTokens)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.authTokens.id, row.id));
        return this.issueTokens(user.id, user.role, row.deviceId ?? undefined);
    }
    async me(userId) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user) {
            throw new common_1.UnauthorizedException('User no longer exists');
        }
        const { passwordHash: _passwordHash, ...safeUser } = user;
        return safeUser;
    }
    async updateEmail(userId, email) {
        const [existing] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email)).limit(1);
        if (existing && existing.id !== userId) {
            throw new common_1.ConflictException('This email is already in use by another account');
        }
        const [user] = await this.db.update(schema_1.users).set({ email }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).returning();
        if (!user)
            throw new common_1.UnauthorizedException('User no longer exists');
        const { passwordHash: _passwordHash, ...safeUser } = user;
        return safeUser;
    }
    async updateProfile(userId, dto) {
        if (dto.email) {
            const [existing] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, dto.email)).limit(1);
            if (existing && existing.id !== userId) {
                throw new common_1.ConflictException('This email is already in use by another account');
            }
        }
        const updates = {};
        if (dto.name !== undefined)
            updates.name = dto.name.trim();
        if (dto.email !== undefined)
            updates.email = dto.email.trim();
        if (Object.keys(updates).length === 0)
            return this.me(userId);
        const [user] = await this.db.update(schema_1.users).set(updates).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).returning();
        if (!user)
            throw new common_1.UnauthorizedException('User no longer exists');
        const { passwordHash: _passwordHash, ...safeUser } = user;
        return safeUser;
    }
    async deleteAccount(userId) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.role === 'vendor') {
            const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId)).limit(1);
            if (vendor) {
                const activeGrocery = await this.db
                    .select({ id: schema_1.groceryOrders.id })
                    .from(schema_1.groceryOrders)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendor.id), (0, drizzle_orm_1.inArray)(schema_1.groceryOrders.status, [
                    'placed',
                    'vendor_accepted',
                    'preparing',
                    'ready',
                    'handed_over',
                    'delivery_assigned',
                    'picked_up',
                    'out_for_delivery',
                ])))
                    .limit(1);
                const [restaurant] = await this.db
                    .select()
                    .from(schema_1.restaurants)
                    .where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendor.id))
                    .limit(1);
                let activeFood = [];
                if (restaurant) {
                    activeFood = await this.db
                        .select({ id: schema_1.foodOrders.id })
                        .from(schema_1.foodOrders)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.inArray)(schema_1.foodOrders.status, [
                        'placed',
                        'vendor_accepted',
                        'preparing',
                        'ready',
                        'handed_over',
                        'delivery_assigned',
                        'picked_up',
                        'out_for_delivery',
                    ])))
                        .limit(1);
                }
                if (activeGrocery.length > 0 || activeFood.length > 0) {
                    throw new common_1.BadRequestException('Cannot delete account while you have active orders in progress. Please complete or cancel remaining orders first.');
                }
                await this.db
                    .update(schema_1.vendors)
                    .set({ isOpen: false })
                    .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendor.id));
                if (restaurant) {
                    await this.db
                        .update(schema_1.restaurants)
                        .set({ isOpen: false })
                        .where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, restaurant.id));
                }
            }
        }
        else if (user.role === 'delivery_partner') {
            await this.db
                .update(schema_1.deliveryPartners)
                .set({ isOnline: false })
                .where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.userId, userId));
        }
        await this.db
            .update(schema_1.users)
            .set({ status: 'suspended', phone: null, email: null })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        await this.db
            .update(schema_1.authTokens)
            .set({ revokedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.authTokens.userId, userId));
        return { success: true, message: 'Account deleted successfully' };
    }
    async findOrCreateByPhone(phone, role) {
        const [existing] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, phone), (0, drizzle_orm_1.eq)(schema_1.users.role, role)))
            .limit(1);
        if (existing)
            return existing;
        try {
            const [created] = await this.db.insert(schema_1.users).values({ phone, role }).returning();
            return created;
        }
        catch {
            throw new common_1.ConflictException('Account creation conflict — try again');
        }
    }
    async issueTokens(userId, role, deviceId) {
        const accessExpiresIn = this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m';
        const accessSecret = this.config.get('JWT_ACCESS_SECRET');
        const refreshSecret = this.config.get('JWT_REFRESH_SECRET');
        const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '30d';
        const accessPayload = { sub: userId, role };
        const accessToken = this.jwt.sign(accessPayload, {
            secret: accessSecret,
            expiresIn: Math.floor((0, duration_1.parseDurationMs)(accessExpiresIn, 15 * 60 * 1000) / 1000),
        });
        const jti = (0, crypto_1.randomUUID)();
        const refreshPayload = { sub: userId, jti };
        const refreshToken = this.jwt.sign(refreshPayload, {
            secret: refreshSecret,
            expiresIn: Math.floor((0, duration_1.parseDurationMs)(refreshExpiresIn, 30 * 24 * 60 * 60 * 1000) / 1000),
        });
        await this.db.insert(schema_1.authTokens).values({
            id: jti,
            userId,
            refreshTokenHash: hashToken(refreshToken),
            deviceId: deviceId ?? null,
            expiresAt: new Date(Date.now() + (0, duration_1.parseDurationMs)(refreshExpiresIn, 30 * 24 * 60 * 60 * 1000)),
        });
        return { accessToken, refreshToken };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
//# sourceMappingURL=auth.service.js.map