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
let CouponService = class CouponService {
    db;
    constructor(db) {
        this.db = db;
    }
    async listAllForAdmin() {
        return this.db.select().from(schema_1.coupons).orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt));
    }
    async listActive() {
        return this.db
            .select({
            id: schema_1.coupons.id,
            code: schema_1.coupons.code,
            discountType: schema_1.coupons.discountType,
            discountValue: schema_1.coupons.discountValue,
            minOrderValue: schema_1.coupons.minOrderValue,
            maxDiscount: schema_1.coupons.maxDiscount,
            description: schema_1.coupons.description,
            isFirstOrderOnly: schema_1.coupons.isFirstOrderOnly,
        })
            .from(schema_1.coupons)
            .where((0, drizzle_orm_1.eq)(schema_1.coupons.isActive, true))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.coupons.createdAt));
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
            isActive: dto.isActive ?? true,
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
        if (dto.isActive !== undefined)
            updates.isActive = dto.isActive;
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
    async validate(code, subtotal, userId) {
        const cleanCode = (code || '').trim().toUpperCase();
        if (!cleanCode) {
            return { valid: false, message: 'Please enter a coupon code', discount: 0 };
        }
        const [coupon] = await this.db.select().from(schema_1.coupons).where((0, drizzle_orm_1.eq)(schema_1.coupons.code, cleanCode));
        if (!coupon || !coupon.isActive) {
            return { valid: false, message: 'Invalid or expired coupon code', discount: 0 };
        }
        if (subtotal < coupon.minOrderValue) {
            return {
                valid: false,
                message: `Min order of ₹${coupon.minOrderValue} required for ${coupon.code} (add ₹${coupon.minOrderValue - subtotal} more)`,
                discount: 0,
            };
        }
        if (coupon.isFirstOrderOnly) {
            if (userId) {
                const existingGrocery = await this.db
                    .select({ id: schema_1.groceryOrders.id })
                    .from(schema_1.groceryOrders)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, userId), (0, drizzle_orm_1.notInArray)(schema_1.groceryOrders.status, ['cancelled', 'failed'])))
                    .limit(1);
                const existingFood = await this.db
                    .select({ id: schema_1.foodOrders.id })
                    .from(schema_1.foodOrders)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, userId), (0, drizzle_orm_1.notInArray)(schema_1.foodOrders.status, ['cancelled', 'failed'])))
                    .limit(1);
                if (existingGrocery.length > 0 || existingFood.length > 0) {
                    return {
                        valid: false,
                        message: `Coupon ${coupon.code} is valid only on your first order!`,
                        discount: 0,
                    };
                }
            }
        }
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            const raw = Math.round((subtotal * coupon.discountValue) / 100);
            discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
        }
        else if (coupon.discountType === 'flat') {
            discount = Math.min(coupon.discountValue, subtotal);
        }
        else if (coupon.discountType === 'free_delivery') {
            discount = 15;
        }
        return {
            valid: true,
            message: `Coupon ${coupon.code} applied! Saved ₹${discount}`,
            discount,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minOrderValue: coupon.minOrderValue,
                maxDiscount: coupon.maxDiscount,
                description: coupon.description,
                isFirstOrderOnly: coupon.isFirstOrderOnly,
            },
        };
    }
};
exports.CouponService = CouponService;
exports.CouponService = CouponService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], CouponService);
//# sourceMappingURL=coupon.service.js.map