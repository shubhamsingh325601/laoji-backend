"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const catalog_types_1 = require("../catalog/catalog.types");
const COUNTED_PAYMENT_STATUSES = ['paid', 'pending_cod', 'collected'];
function toPublicCoupon(c) {
    return {
        code: c.code,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        description: c.description,
        isFirstOrderOnly: c.isFirstOrderOnly,
        firstNOrders: firstNOrdersOf(c),
        vendorId: c.vendorId,
        showInApp: c.showInApp,
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
    };
}
function firstNOrdersOf(c) {
    if (c.firstNOrders != null)
        return c.firstNOrders;
    return c.isFirstOrderOnly ? 1 : null;
}
let CouponService = class CouponService {
    db;
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        try {
            await this.db.execute((0, drizzle_orm_1.sql) `
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "beneficiary_user_id" uuid;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "show_in_app" boolean NOT NULL DEFAULT false;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "affiliate_commission_type" varchar(20);
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "affiliate_commission_value" double precision;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_uses_per_user" integer;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_total_uses" integer;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "total_redemptions" integer NOT NULL DEFAULT 0;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;
        ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;

        -- Ensure only public platform global coupons (FREEDELIVERY, FREEDEL, FREEDEL3) are visible in app,
        -- all other vendor / creator / affiliate coupons are hidden from public app listings.
        UPDATE "coupons"
        SET "show_in_app" = false
        WHERE UPPER("code") NOT IN ('FREEDELIVERY', 'FREEDEL', 'FREEDEL3');

        UPDATE "coupons"
        SET "show_in_app" = true
        WHERE UPPER("code") IN ('FREEDELIVERY', 'FREEDEL', 'FREEDEL3');
      `);
        }
        catch (err) {
            console.warn('[CouponService] Auto-migration notice:', err);
        }
    }
    async listAllForAdmin() {
        const rows = await this.db
            .select({
            id: schema_1.coupons.id,
            code: schema_1.coupons.code,
            discountType: schema_1.coupons.discountType,
            discountValue: schema_1.coupons.discountValue,
            minOrderValue: schema_1.coupons.minOrderValue,
            maxDiscount: schema_1.coupons.maxDiscount,
            description: schema_1.coupons.description,
            isFirstOrderOnly: schema_1.coupons.isFirstOrderOnly,
            firstNOrders: schema_1.coupons.firstNOrders,
            isActive: schema_1.coupons.isActive,
            vendorId: schema_1.coupons.vendorId,
            beneficiaryUserId: schema_1.coupons.beneficiaryUserId,
            showInApp: schema_1.coupons.showInApp,
            affiliateCommissionType: schema_1.coupons.affiliateCommissionType,
            affiliateCommissionValue: schema_1.coupons.affiliateCommissionValue,
            maxUsesPerUser: schema_1.coupons.maxUsesPerUser,
            maxTotalUses: schema_1.coupons.maxTotalUses,
            totalRedemptions: schema_1.coupons.totalRedemptions,
            startsAt: schema_1.coupons.startsAt,
            expiresAt: schema_1.coupons.expiresAt,
            createdAt: schema_1.coupons.createdAt,
            beneficiaryName: schema_1.users.name,
            beneficiaryPhone: schema_1.users.phone,
            beneficiaryRole: schema_1.users.role,
        })
            .from(schema_1.coupons)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.coupons.beneficiaryUserId, schema_1.users.id))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt));
        return rows;
    }
    async listActive(vendorId) {
        const condition = vendorId
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true), (0, drizzle_orm_1.eq)(schema_1.coupons.showInApp, true), (0, drizzle_orm_1.eq)(schema_1.coupons.discountType, 'free_delivery'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.coupons.vendorId), (0, drizzle_orm_1.eq)(schema_1.coupons.vendorId, vendorId)))
            : (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true), (0, drizzle_orm_1.eq)(schema_1.coupons.showInApp, true), (0, drizzle_orm_1.eq)(schema_1.coupons.discountType, 'free_delivery'));
        const rows = await this.db
            .select()
            .from(schema_1.coupons)
            .where(condition)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt));
        const now = new Date();
        const active = rows.filter((c) => {
            if (c.startsAt && now < new Date(c.startsAt))
                return false;
            if (c.expiresAt && now > new Date(c.expiresAt))
                return false;
            return true;
        });
        const limited = active.slice(0, 3);
        return limited.map((c) => ({ id: c.id, ...toPublicCoupon(c) }));
    }
    async create(dto) {
        const cleanCode = dto.code.trim().toUpperCase();
        if (!cleanCode) {
            throw new common_1.BadRequestException('Coupon code cannot be empty');
        }
        const [existing] = await this.db.select().from(schema_1.coupons).where((0, drizzle_orm_1.eq)(schema_1.coupons.code, cleanCode));
        if (existing) {
            throw new common_1.BadRequestException(`Coupon with code ${cleanCode} already exists`);
        }
        const [created] = await this.db
            .insert(schema_1.coupons)
            .values({
            code: cleanCode,
            discountType: dto.discountType,
            discountValue: dto.discountValue,
            minOrderValue: dto.minOrderValue ?? 0,
            maxDiscount: dto.maxDiscount ?? null,
            description: dto.description ?? null,
            isFirstOrderOnly: dto.isFirstOrderOnly ?? false,
            firstNOrders: dto.firstNOrders ?? null,
            isActive: dto.isActive ?? true,
            vendorId: dto.vendorId ?? null,
            beneficiaryUserId: dto.beneficiaryUserId ?? null,
            showInApp: dto.showInApp ?? false,
            affiliateCommissionType: dto.affiliateCommissionType ?? null,
            affiliateCommissionValue: dto.affiliateCommissionValue ?? null,
            maxUsesPerUser: dto.maxUsesPerUser ?? null,
            maxTotalUses: dto.maxTotalUses ?? null,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        })
            .returning();
        return created;
    }
    async update(id, dto) {
        const [existing] = await this.db.select().from(schema_1.coupons).where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id));
        if (!existing) {
            throw new common_1.NotFoundException('Coupon not found');
        }
        const updates = {};
        if (dto.code !== undefined)
            updates.code = dto.code.trim().toUpperCase();
        if (dto.discountType !== undefined)
            updates.discountType = dto.discountType;
        if (dto.discountValue !== undefined)
            updates.discountValue = dto.discountValue;
        if (dto.minOrderValue !== undefined)
            updates.minOrderValue = dto.minOrderValue;
        if (dto.maxDiscount !== undefined)
            updates.maxDiscount = dto.maxDiscount;
        if (dto.description !== undefined)
            updates.description = dto.description;
        if (dto.isFirstOrderOnly !== undefined)
            updates.isFirstOrderOnly = dto.isFirstOrderOnly;
        if (dto.firstNOrders !== undefined)
            updates.firstNOrders = dto.firstNOrders;
        if (dto.isActive !== undefined)
            updates.isActive = dto.isActive;
        if (dto.vendorId !== undefined)
            updates.vendorId = dto.vendorId;
        if (dto.beneficiaryUserId !== undefined)
            updates.beneficiaryUserId = dto.beneficiaryUserId;
        if (dto.showInApp !== undefined)
            updates.showInApp = dto.showInApp;
        if (dto.affiliateCommissionType !== undefined)
            updates.affiliateCommissionType = dto.affiliateCommissionType;
        if (dto.affiliateCommissionValue !== undefined)
            updates.affiliateCommissionValue = dto.affiliateCommissionValue;
        if (dto.maxUsesPerUser !== undefined)
            updates.maxUsesPerUser = dto.maxUsesPerUser;
        if (dto.maxTotalUses !== undefined)
            updates.maxTotalUses = dto.maxTotalUses;
        if (dto.startsAt !== undefined)
            updates.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
        if (dto.expiresAt !== undefined)
            updates.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
        const [updated] = await this.db
            .update(schema_1.coupons)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id))
            .returning();
        return updated;
    }
    async delete(id) {
        const [existing] = await this.db.select().from(schema_1.coupons).where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id));
        if (!existing) {
            throw new common_1.NotFoundException('Coupon not found');
        }
        await this.db.delete(schema_1.coupons).where((0, drizzle_orm_1.eq)(schema_1.coupons.id, id));
        return { success: true, message: 'Coupon deleted successfully' };
    }
    async countPlacedOrders(userId) {
        const counted = (table) => this.db
            .select({ id: table.id })
            .from(table)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.customerId, userId), (0, drizzle_orm_1.notInArray)(table.status, ['cancelled', 'failed']), (0, drizzle_orm_1.inArray)(table.paymentStatus, COUNTED_PAYMENT_STATUSES)));
        const [grocery, food] = await Promise.all([counted(schema_1.groceryOrders), counted(schema_1.foodOrders)]);
        return grocery.length + food.length;
    }
    async countCouponOrdersForUser(couponCode, userId) {
        const counted = (table) => this.db
            .select({ id: table.id })
            .from(table)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.customerId, userId), (0, drizzle_orm_1.eq)(table.couponCode, couponCode), (0, drizzle_orm_1.notInArray)(table.status, ['cancelled', 'failed'])));
        const [grocery, food] = await Promise.all([counted(schema_1.groceryOrders), counted(schema_1.foodOrders)]);
        return grocery.length + food.length;
    }
    async countTotalCouponOrders(couponCode) {
        const counted = (table) => this.db
            .select({ id: table.id })
            .from(table)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.couponCode, couponCode), (0, drizzle_orm_1.notInArray)(table.status, ['cancelled', 'failed'])));
        const [grocery, food] = await Promise.all([counted(schema_1.groceryOrders), counted(schema_1.foodOrders)]);
        return grocery.length + food.length;
    }
    async evaluate(code, ctx) {
        const cleanCode = (code || '').trim().toUpperCase();
        if (!cleanCode) {
            return { valid: false, message: 'Please enter a coupon code', discount: 0 };
        }
        const [coupon] = await this.db
            .select()
            .from(schema_1.coupons)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.code, cleanCode), (0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true)));
        if (!coupon) {
            return { valid: false, message: 'Invalid or inactive coupon code', discount: 0 };
        }
        const now = new Date();
        if (coupon.startsAt && now < new Date(coupon.startsAt)) {
            return { valid: false, message: `Coupon ${coupon.code} is not active yet`, discount: 0 };
        }
        if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
            return { valid: false, message: `Coupon ${coupon.code} has expired`, discount: 0 };
        }
        if (coupon.vendorId && coupon.vendorId !== ctx.vendorId) {
            return { valid: false, message: 'Coupon is not valid for this vendor', discount: 0 };
        }
        if (ctx.subtotal < coupon.minOrderValue) {
            return {
                valid: false,
                message: `Min order of ₹${coupon.minOrderValue} required for ${coupon.code} (add ₹${coupon.minOrderValue - ctx.subtotal} more)`,
                discount: 0,
            };
        }
        const firstN = firstNOrdersOf(coupon);
        if (firstN != null && ctx.userId) {
            const placed = await this.countPlacedOrders(ctx.userId);
            if (placed >= firstN) {
                return {
                    valid: false,
                    message: firstN === 1
                        ? `Coupon ${coupon.code} is valid only on your first order`
                        : `Coupon ${coupon.code} is valid only on your first ${firstN} orders`,
                    discount: 0,
                };
            }
        }
        if (coupon.maxUsesPerUser != null && ctx.userId) {
            const userUsage = await this.countCouponOrdersForUser(cleanCode, ctx.userId);
            if (userUsage >= coupon.maxUsesPerUser) {
                return {
                    valid: false,
                    message: coupon.maxUsesPerUser === 1
                        ? `You have already used coupon ${coupon.code}`
                        : `You have reached the maximum allowed uses (${coupon.maxUsesPerUser}) for ${coupon.code}`,
                    discount: 0,
                };
            }
        }
        if (coupon.maxTotalUses != null) {
            const totalUsage = await this.countTotalCouponOrders(cleanCode);
            if (totalUsage >= coupon.maxTotalUses) {
                return {
                    valid: false,
                    message: `Coupon ${coupon.code} has reached its maximum usage limit`,
                    discount: 0,
                };
            }
        }
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            const raw = Math.round((ctx.subtotal * coupon.discountValue) / 100);
            discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
        }
        else if (coupon.discountType === 'flat') {
            discount = Math.min(coupon.discountValue, ctx.subtotal);
        }
        else if (coupon.discountType === 'free_delivery') {
            if (ctx.noFreeDeliveryVoucher) {
                return {
                    valid: false,
                    message: `Free delivery vouchers apply only within ${catalog_types_1.CORE_DELIVERY_RADIUS_KM} km of Sangod centre`,
                    discount: 0,
                };
            }
            if (ctx.deliveryFee <= 0) {
                return { valid: false, message: 'Delivery is already free on this order', discount: 0 };
            }
            discount = ctx.deliveryFee;
        }
        return {
            valid: true,
            message: coupon.discountType === 'free_delivery'
                ? `Coupon ${coupon.code} applied! Free delivery`
                : `Coupon ${coupon.code} applied! Saved ₹${discount}`,
            discount,
            coupon: toPublicCoupon(coupon),
        };
    }
    async findAutoApply(ctx) {
        if (ctx.deliveryFee <= 0)
            return null;
        const candidates = (await this.db
            .select()
            .from(schema_1.coupons)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true), (0, drizzle_orm_1.eq)(schema_1.coupons.showInApp, true), (0, drizzle_orm_1.eq)(schema_1.coupons.discountType, 'free_delivery')))).filter((c) => firstNOrdersOf(c) != null);
        let best = null;
        for (const c of candidates) {
            const evaluation = await this.evaluate(c.code, ctx);
            if (evaluation.valid && (!best || evaluation.discount > best.evaluation.discount)) {
                best = { code: c.code, evaluation };
            }
        }
        return best;
    }
    async validate(code, subtotal, userId, vendorId) {
        const res = await this.evaluate(code, { subtotal, deliveryFee: Number.POSITIVE_INFINITY, userId, vendorId });
        if (res.valid && res.coupon?.discountType === 'free_delivery') {
            return { ...res, discount: 0 };
        }
        return res;
    }
};
exports.CouponService = CouponService;
exports.CouponService = CouponService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], CouponService);
//# sourceMappingURL=coupon.service.js.map