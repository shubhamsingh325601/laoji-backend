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
    async listAllForAdmin() {
        return this.db.select().from(schema_1.coupons).orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt));
    }
    async listActive(vendorId) {
        const condition = vendorId
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.coupons.vendorId), (0, drizzle_orm_1.eq)(schema_1.coupons.vendorId, vendorId)))
            : (0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true);
        const rows = await this.db
            .select()
            .from(schema_1.coupons)
            .where(condition)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt));
        return rows.map((c) => ({ id: c.id, ...toPublicCoupon(c) }));
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
            return { valid: false, message: 'Invalid or expired coupon code', discount: 0 };
        }
        if (coupon.vendorId && coupon.vendorId !== ctx.vendorId) {
            return { valid: false, message: 'Invalid or expired coupon code', discount: 0 };
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
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            const raw = Math.round((ctx.subtotal * coupon.discountValue) / 100);
            discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
        }
        else if (coupon.discountType === 'flat') {
            discount = Math.min(coupon.discountValue, ctx.subtotal);
        }
        else if (coupon.discountType === 'free_delivery') {
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
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true), (0, drizzle_orm_1.eq)(schema_1.coupons.discountType, 'free_delivery')))).filter((c) => firstNOrdersOf(c) != null);
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