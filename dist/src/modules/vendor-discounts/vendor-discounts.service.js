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
exports.VendorDiscountsService = void 0;
exports.currentIstDateAndMinutes = currentIstDateAndMinutes;
exports.parseTimeMinutes = parseTimeMinutes;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
function currentIstDateAndMinutes() {
    const now = new Date();
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffsetMs);
    const dateStr = istTime.toISOString().slice(0, 10);
    const minutes = istTime.getUTCHours() * 60 + istTime.getUTCMinutes();
    return { dateStr, minutes };
}
function parseTimeMinutes(timeStr) {
    if (!timeStr)
        return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2)
        return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m))
        return null;
    return h * 60 + m;
}
let VendorDiscountsService = class VendorDiscountsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        try {
            await this.db.execute((0, drizzle_orm_1.sql) `
        CREATE TABLE IF NOT EXISTS "vendor_discounts" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
          "title" varchar(150) NOT NULL,
          "scope" varchar(30) NOT NULL DEFAULT 'entire_store',
          "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
          "menu_item_id" uuid REFERENCES "menu_items"("id") ON DELETE SET NULL,
          "discount_type" varchar(20) NOT NULL DEFAULT 'percentage',
          "discount_value" double precision NOT NULL DEFAULT 0,
          "max_discount" double precision,
          "min_order_value" double precision NOT NULL DEFAULT 0,
          "total_usage_limit" integer,
          "usage_count" integer NOT NULL DEFAULT 0,
          "per_user_limit" integer NOT NULL DEFAULT 1,
          "start_time" varchar(10),
          "end_time" varchar(10),
          "start_date" date,
          "end_date" date,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamp with time zone NOT NULL DEFAULT now(),
          "updated_at" timestamp with time zone NOT NULL DEFAULT now()
        );
      `);
            await this.db.execute((0, drizzle_orm_1.sql) `
        CREATE TABLE IF NOT EXISTS "vendor_discount_redemptions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "discount_id" uuid NOT NULL REFERENCES "vendor_discounts"("id") ON DELETE CASCADE,
          "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "order_id" uuid,
          "created_at" timestamp with time zone NOT NULL DEFAULT now()
        );
      `);
        }
        catch (err) {
            console.warn('[VendorDiscountsService] Auto-migration notice:', err);
        }
    }
    async listByVendor(vendorId) {
        const rows = await this.db
            .select({
            discount: schema_1.vendorDiscounts,
            productName: schema_1.products.name,
            menuItemName: schema_1.menuItems.name,
        })
            .from(schema_1.vendorDiscounts)
            .leftJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.productId, schema_1.products.id))
            .leftJoin(schema_1.menuItems, (0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.menuItemId, schema_1.menuItems.id))
            .where((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.vendorId, vendorId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.vendorDiscounts.createdAt));
        return rows.map(({ discount, productName, menuItemName }) => ({
            ...discount,
            targetItemName: discount.scope === 'product' ? productName || menuItemName || 'Specific Item' : 'Entire Store',
        }));
    }
    async getById(id) {
        const [row] = await this.db.select().from(schema_1.vendorDiscounts).where((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.id, id)).limit(1);
        if (!row) {
            throw new common_1.NotFoundException('Vendor discount not found');
        }
        return row;
    }
    async create(vendorId, dto) {
        const [vendor] = await this.db.select({ id: schema_1.vendors.id }).from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId)).limit(1);
        if (!vendor) {
            throw new common_1.NotFoundException('Vendor not found');
        }
        if (!dto.title?.trim()) {
            throw new common_1.BadRequestException('Discount title is required');
        }
        if (dto.scope === 'product' && !dto.productId && !dto.menuItemId) {
            throw new common_1.BadRequestException('Please select a product or menu item for product-specific discount');
        }
        const [created] = await this.db
            .insert(schema_1.vendorDiscounts)
            .values({
            vendorId,
            title: dto.title.trim(),
            scope: dto.scope ?? 'entire_store',
            productId: dto.productId || null,
            menuItemId: dto.menuItemId || null,
            discountType: dto.discountType,
            discountValue: Number(dto.discountValue) || 0,
            maxDiscount: dto.maxDiscount != null ? Number(dto.maxDiscount) : null,
            minOrderValue: Number(dto.minOrderValue) || 0,
            totalUsageLimit: dto.totalUsageLimit != null ? Number(dto.totalUsageLimit) : null,
            usageCount: 0,
            perUserLimit: Number(dto.perUserLimit) || 1,
            startTime: dto.startTime?.trim() || null,
            endTime: dto.endTime?.trim() || null,
            startDate: dto.startDate || null,
            endDate: dto.endDate || null,
            isActive: dto.isActive !== undefined ? dto.isActive : true,
        })
            .returning();
        return created;
    }
    async update(id, dto) {
        const existing = await this.getById(id);
        const updates = {
            updatedAt: new Date(),
        };
        if (dto.title !== undefined)
            updates.title = dto.title.trim();
        if (dto.scope !== undefined)
            updates.scope = dto.scope;
        if (dto.productId !== undefined)
            updates.productId = dto.productId || null;
        if (dto.menuItemId !== undefined)
            updates.menuItemId = dto.menuItemId || null;
        if (dto.discountType !== undefined)
            updates.discountType = dto.discountType;
        if (dto.discountValue !== undefined)
            updates.discountValue = Number(dto.discountValue);
        if (dto.maxDiscount !== undefined)
            updates.maxDiscount = dto.maxDiscount != null ? Number(dto.maxDiscount) : null;
        if (dto.minOrderValue !== undefined)
            updates.minOrderValue = Number(dto.minOrderValue);
        if (dto.totalUsageLimit !== undefined)
            updates.totalUsageLimit = dto.totalUsageLimit != null ? Number(dto.totalUsageLimit) : null;
        if (dto.perUserLimit !== undefined)
            updates.perUserLimit = Number(dto.perUserLimit);
        if (dto.startTime !== undefined)
            updates.startTime = dto.startTime?.trim() || null;
        if (dto.endTime !== undefined)
            updates.endTime = dto.endTime?.trim() || null;
        if (dto.startDate !== undefined)
            updates.startDate = dto.startDate || null;
        if (dto.endDate !== undefined)
            updates.endDate = dto.endDate || null;
        if (dto.isActive !== undefined)
            updates.isActive = dto.isActive;
        const [updated] = await this.db
            .update(schema_1.vendorDiscounts)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.id, id))
            .returning();
        return updated;
    }
    async toggleActive(id) {
        const existing = await this.getById(id);
        const [updated] = await this.db
            .update(schema_1.vendorDiscounts)
            .set({
            isActive: !existing.isActive,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.id, id))
            .returning();
        return updated;
    }
    async delete(id) {
        await this.getById(id);
        await this.db.delete(schema_1.vendorDiscounts).where((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.id, id));
        return { success: true, message: 'Vendor discount deleted successfully' };
    }
    async getActiveDiscountsForVendor(vendorId, userId) {
        const rows = await this.db
            .select()
            .from(schema_1.vendorDiscounts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.isActive, true)));
        if (rows.length === 0)
            return [];
        const { dateStr: today, minutes: currentMinutes } = currentIstDateAndMinutes();
        const userRedemptionsMap = new Map();
        if (userId) {
            const redemptions = await this.db
                .select({ discountId: schema_1.vendorDiscountRedemptions.discountId })
                .from(schema_1.vendorDiscountRedemptions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorDiscountRedemptions.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.vendorDiscountRedemptions.userId, userId)));
            for (const r of redemptions) {
                userRedemptionsMap.set(r.discountId, (userRedemptionsMap.get(r.discountId) ?? 0) + 1);
            }
        }
        return rows.filter((d) => {
            if (d.totalUsageLimit != null && d.usageCount >= d.totalUsageLimit) {
                return false;
            }
            if (userId && d.perUserLimit != null) {
                const usedByUser = userRedemptionsMap.get(d.id) ?? 0;
                if (usedByUser >= d.perUserLimit) {
                    return false;
                }
            }
            if (d.startDate && today < d.startDate)
                return false;
            if (d.endDate && today > d.endDate)
                return false;
            const startMin = parseTimeMinutes(d.startTime);
            const endMin = parseTimeMinutes(d.endTime);
            if (startMin != null && endMin != null) {
                if (startMin <= endMin) {
                    if (currentMinutes < startMin || currentMinutes > endMin)
                        return false;
                }
                else {
                    if (currentMinutes < startMin && currentMinutes > endMin)
                        return false;
                }
            }
            return true;
        });
    }
    calculateItemDiscount(itemPrice, discounts, itemTarget) {
        let bestDiscountAmount = 0;
        let bestDiscount = null;
        let bestLabel = null;
        for (const d of discounts) {
            let isMatch = false;
            if (d.scope === 'entire_store') {
                isMatch = true;
            }
            else if (d.scope === 'product') {
                if (d.productId && itemTarget.productId && d.productId === itemTarget.productId) {
                    isMatch = true;
                }
                else if (d.menuItemId && itemTarget.menuItemId && d.menuItemId === itemTarget.menuItemId) {
                    isMatch = true;
                }
            }
            if (!isMatch)
                continue;
            let amount = 0;
            let label = '';
            if (d.discountType === 'percentage') {
                const raw = (itemPrice * d.discountValue) / 100;
                amount = d.maxDiscount ? Math.min(raw, d.maxDiscount) : raw;
                label = `↓${Math.round(d.discountValue)}% OFF`;
            }
            else if (d.discountType === 'flat') {
                amount = Math.min(d.discountValue, itemPrice);
                label = `₹${Math.round(d.discountValue)} OFF`;
            }
            if (amount > bestDiscountAmount) {
                bestDiscountAmount = amount;
                bestDiscount = d;
                bestLabel = label;
            }
        }
        if (bestDiscountAmount > 0 && bestDiscount) {
            const discountedPrice = Math.max(0, Math.round((itemPrice - bestDiscountAmount) * 100) / 100);
            return {
                originalPrice: itemPrice,
                price: discountedPrice,
                discountLabel: bestLabel,
                discountApplied: bestDiscount,
            };
        }
        return {
            originalPrice: itemPrice,
            price: itemPrice,
            discountLabel: null,
            discountApplied: null,
        };
    }
    async recordRedemption(discountId, vendorId, userId, orderId) {
        try {
            await this.db.insert(schema_1.vendorDiscountRedemptions).values({
                discountId,
                vendorId,
                userId,
                orderId: orderId || null,
            });
            await this.db
                .update(schema_1.vendorDiscounts)
                .set({
                usageCount: (0, drizzle_orm_1.sql) `${schema_1.vendorDiscounts.usageCount} + 1`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.vendorDiscounts.id, discountId));
        }
        catch (err) {
            console.warn('[VendorDiscountsService] Failed to record redemption:', err);
        }
    }
};
exports.VendorDiscountsService = VendorDiscountsService;
exports.VendorDiscountsService = VendorDiscountsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], VendorDiscountsService);
//# sourceMappingURL=vendor-discounts.service.js.map