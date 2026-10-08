import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { coupons, foodOrders, groceryOrders, users } from '../../../drizzle/schema';
import { CORE_DELIVERY_RADIUS_KM } from '../catalog/catalog.types';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';

type CouponRow = typeof coupons.$inferSelect;

export interface CouponEvaluation {
  valid: boolean;
  message: string;
  discount: number;
  coupon?: ReturnType<typeof toPublicCoupon>;
}

// Payment statuses of orders that really went through. An order left at
// 'pending' is an abandoned checkout and must not use up a first-N voucher.
const COUNTED_PAYMENT_STATUSES = ['paid', 'pending_cod', 'collected'];

function toPublicCoupon(c: CouponRow) {
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

function firstNOrdersOf(c: CouponRow): number | null {
  if (c.firstNOrders != null) return c.firstNOrders;
  return c.isFirstOrderOnly ? 1 : null;
}

@Injectable()
export class CouponService implements OnModuleInit {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`
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
    } catch (err) {
      console.warn('[CouponService] Auto-migration notice:', err);
    }
  }

  async listAllForAdmin() {
    const rows = await this.db
      .select({
        id: coupons.id,
        code: coupons.code,
        discountType: coupons.discountType,
        discountValue: coupons.discountValue,
        minOrderValue: coupons.minOrderValue,
        maxDiscount: coupons.maxDiscount,
        description: coupons.description,
        isFirstOrderOnly: coupons.isFirstOrderOnly,
        firstNOrders: coupons.firstNOrders,
        isActive: coupons.isActive,
        vendorId: coupons.vendorId,
        beneficiaryUserId: coupons.beneficiaryUserId,
        showInApp: coupons.showInApp,
        affiliateCommissionType: coupons.affiliateCommissionType,
        affiliateCommissionValue: coupons.affiliateCommissionValue,
        maxUsesPerUser: coupons.maxUsesPerUser,
        maxTotalUses: coupons.maxTotalUses,
        totalRedemptions: coupons.totalRedemptions,
        startsAt: coupons.startsAt,
        expiresAt: coupons.expiresAt,
        createdAt: coupons.createdAt,
        beneficiaryName: users.name,
        beneficiaryPhone: users.phone,
        beneficiaryRole: users.role,
      })
      .from(coupons)
      .leftJoin(users, eq(coupons.beneficiaryUserId, users.id))
      .orderBy(desc(coupons.createdAt));
    return rows;
  }

  /**
   * Only return coupons that are active AND marked as showInApp=true.
   * Creator/Vendor affiliate coupons (showInApp=false) are hidden and must be given manually.
   */
  async listActive(vendorId?: string) {
    const condition = vendorId
      ? and(
          eq(coupons.isActive, true),
          eq(coupons.showInApp, true),
          eq(coupons.discountType, 'free_delivery'),
          or(isNull(coupons.vendorId), eq(coupons.vendorId, vendorId)),
        )
      : and(eq(coupons.isActive, true), eq(coupons.showInApp, true), eq(coupons.discountType, 'free_delivery'));

    const rows = await this.db
      .select()
      .from(coupons)
      .where(condition)
      .orderBy(desc(coupons.createdAt));

    // Filter out expired coupons or coupons not yet active
    const now = new Date();
    const active = rows.filter((c) => {
      if (c.startsAt && now < new Date(c.startsAt)) return false;
      if (c.expiresAt && now > new Date(c.expiresAt)) return false;
      return true;
    });

    // Limit to 3 coupons
    const limited = active.slice(0, 3);

    return limited.map((c) => ({ id: c.id, ...toPublicCoupon(c) }));
  }

  async create(dto: CreateCouponDto) {
    const cleanCode = dto.code.trim().toUpperCase();
    if (!cleanCode) {
      throw new BadRequestException('Coupon code cannot be empty');
    }

    const [existing] = await this.db.select().from(coupons).where(eq(coupons.code, cleanCode));
    if (existing) {
      throw new BadRequestException(`Coupon with code ${cleanCode} already exists`);
    }

    const [created] = await this.db
      .insert(coupons)
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

  async update(id: string, dto: UpdateCouponDto) {
    const [existing] = await this.db.select().from(coupons).where(eq(coupons.id, id));
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    const updates: Partial<typeof coupons.$inferInsert> = {};
    if (dto.code !== undefined) updates.code = dto.code.trim().toUpperCase();
    if (dto.discountType !== undefined) updates.discountType = dto.discountType;
    if (dto.discountValue !== undefined) updates.discountValue = dto.discountValue;
    if (dto.minOrderValue !== undefined) updates.minOrderValue = dto.minOrderValue;
    if (dto.maxDiscount !== undefined) updates.maxDiscount = dto.maxDiscount;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.isFirstOrderOnly !== undefined) updates.isFirstOrderOnly = dto.isFirstOrderOnly;
    if (dto.firstNOrders !== undefined) updates.firstNOrders = dto.firstNOrders;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.vendorId !== undefined) updates.vendorId = dto.vendorId;
    if (dto.beneficiaryUserId !== undefined) updates.beneficiaryUserId = dto.beneficiaryUserId;
    if (dto.showInApp !== undefined) updates.showInApp = dto.showInApp;
    if (dto.affiliateCommissionType !== undefined) updates.affiliateCommissionType = dto.affiliateCommissionType;
    if (dto.affiliateCommissionValue !== undefined) updates.affiliateCommissionValue = dto.affiliateCommissionValue;
    if (dto.maxUsesPerUser !== undefined) updates.maxUsesPerUser = dto.maxUsesPerUser;
    if (dto.maxTotalUses !== undefined) updates.maxTotalUses = dto.maxTotalUses;
    if (dto.startsAt !== undefined) updates.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.expiresAt !== undefined) updates.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const [updated] = await this.db
      .update(coupons)
      .set(updates)
      .where(eq(coupons.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    const [existing] = await this.db.select().from(coupons).where(eq(coupons.id, id));
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    await this.db.delete(coupons).where(eq(coupons.id, id));
    return { success: true, message: 'Coupon deleted successfully' };
  }

  // Customer's orders that went through (see COUNTED_PAYMENT_STATUSES).
  async countPlacedOrders(userId: string): Promise<number> {
    const counted = (table: typeof groceryOrders | typeof foodOrders) =>
      this.db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.customerId, userId),
            notInArray(table.status, ['cancelled', 'failed']),
            inArray(table.paymentStatus, COUNTED_PAYMENT_STATUSES),
          ),
        );
    const [grocery, food] = await Promise.all([counted(groceryOrders), counted(foodOrders)]);
    return grocery.length + food.length;
  }

  /**
   * Count how many non-cancelled orders a specific customer has placed using this coupon code.
   */
  async countCouponOrdersForUser(couponCode: string, userId: string): Promise<number> {
    const counted = (table: typeof groceryOrders | typeof foodOrders) =>
      this.db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.customerId, userId),
            eq(table.couponCode, couponCode),
            notInArray(table.status, ['cancelled', 'failed']),
          ),
        );
    const [grocery, food] = await Promise.all([counted(groceryOrders), counted(foodOrders)]);
    return grocery.length + food.length;
  }

  /**
   * Count total non-cancelled orders placed platform-wide with this coupon code.
   */
  async countTotalCouponOrders(couponCode: string): Promise<number> {
    const counted = (table: typeof groceryOrders | typeof foodOrders) =>
      this.db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.couponCode, couponCode),
            notInArray(table.status, ['cancelled', 'failed']),
          ),
        );
    const [grocery, food] = await Promise.all([counted(groceryOrders), counted(foodOrders)]);
    return grocery.length + food.length;
  }

  /**
   * Decides whether `code` applies to a cart and how much it takes off.
   */
  async evaluate(
    code: string,
    ctx: { subtotal: number; deliveryFee: number; userId?: string; vendorId?: string; noFreeDeliveryVoucher?: boolean },
  ): Promise<CouponEvaluation> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, message: 'Please enter a coupon code', discount: 0 };
    }

    const [coupon] = await this.db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, cleanCode), eq(coupons.isActive, true)));
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

    // First N orders restriction (for customer welcome vouchers)
    const firstN = firstNOrdersOf(coupon);
    if (firstN != null && ctx.userId) {
      const placed = await this.countPlacedOrders(ctx.userId);
      if (placed >= firstN) {
        return {
          valid: false,
          message:
            firstN === 1
              ? `Coupon ${coupon.code} is valid only on your first order`
              : `Coupon ${coupon.code} is valid only on your first ${firstN} orders`,
          discount: 0,
        };
      }
    }

    // Per-user usage limit (e.g. 1 user 1 time for affiliate/creator coupons)
    if (coupon.maxUsesPerUser != null && ctx.userId) {
      const userUsage = await this.countCouponOrdersForUser(cleanCode, ctx.userId);
      if (userUsage >= coupon.maxUsesPerUser) {
        return {
          valid: false,
          message:
            coupon.maxUsesPerUser === 1
              ? `You have already used coupon ${coupon.code}`
              : `You have reached the maximum allowed uses (${coupon.maxUsesPerUser}) for ${coupon.code}`,
          discount: 0,
        };
      }
    }

    // Total redemption limit (e.g. first 50 users)
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
    } else if (coupon.discountType === 'flat') {
      discount = Math.min(coupon.discountValue, ctx.subtotal);
    } else if (coupon.discountType === 'free_delivery') {
      if (ctx.noFreeDeliveryVoucher) {
        return {
          valid: false,
          message: `Free delivery vouchers apply only within ${CORE_DELIVERY_RADIUS_KM} km of Sangod centre`,
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
      message:
        coupon.discountType === 'free_delivery'
          ? `Coupon ${coupon.code} applied! Free delivery`
          : `Coupon ${coupon.code} applied! Saved ₹${discount}`,
      discount,
      coupon: toPublicCoupon(coupon),
    };
  }

  /**
   * Welcome vouchers apply without being typed in: only active public free-delivery vouchers.
   */
  async findAutoApply(ctx: {
    subtotal: number;
    deliveryFee: number;
    userId: string;
    vendorId?: string;
    noFreeDeliveryVoucher?: boolean;
  }) {
    if (ctx.deliveryFee <= 0) return null;
    const candidates = (
      await this.db
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.isActive, true),
            eq(coupons.showInApp, true),
            eq(coupons.discountType, 'free_delivery'),
          ),
        )
    ).filter((c) => firstNOrdersOf(c) != null);

    let best: { code: string; evaluation: CouponEvaluation } | null = null;
    for (const c of candidates) {
      const evaluation = await this.evaluate(c.code, ctx);
      if (evaluation.valid && (!best || evaluation.discount > best.evaluation.discount)) {
        best = { code: c.code, evaluation };
      }
    }
    return best;
  }

  async validate(code: string, subtotal: number, userId?: string, vendorId?: string) {
    const res = await this.evaluate(code, { subtotal, deliveryFee: Number.POSITIVE_INFINITY, userId, vendorId });
    if (res.valid && res.coupon?.discountType === 'free_delivery') {
      return { ...res, discount: 0 };
    }
    return res;
  }
}
