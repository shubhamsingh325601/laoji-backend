import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { coupons, foodOrders, groceryOrders } from '../../../drizzle/schema';
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
  };
}

function firstNOrdersOf(c: CouponRow): number | null {
  if (c.firstNOrders != null) return c.firstNOrders;
  return c.isFirstOrderOnly ? 1 : null;
}

@Injectable()
export class CouponService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async listAllForAdmin() {
    return this.db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async listActive() {
    const rows = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.isActive, true))
      .orderBy(desc(coupons.createdAt));
    return rows.map((c) => ({ id: c.id, ...toPublicCoupon(c) }));
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
   * Decides whether `code` applies to a cart and how much it takes off.
   * A free-delivery voucher's discount is the order's delivery fee, so it's
   * worth nothing on an order that already ships free.
   */
  async evaluate(code: string, ctx: { subtotal: number; deliveryFee: number; userId?: string }): Promise<CouponEvaluation> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, message: 'Please enter a coupon code', discount: 0 };
    }

    const [coupon] = await this.db.select().from(coupons).where(eq(coupons.code, cleanCode));
    if (!coupon || !coupon.isActive) {
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
          message:
            firstN === 1
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
    } else if (coupon.discountType === 'flat') {
      discount = Math.min(coupon.discountValue, ctx.subtotal);
    } else if (coupon.discountType === 'free_delivery') {
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
   * Welcome vouchers apply without being typed in: an active free-delivery
   * voucher limited to a customer's first N orders (FREEDEL3) is picked
   * automatically when the checkout names no coupon. This also covers app
   * builds that never send a coupon code.
   */
  async findAutoApply(ctx: { subtotal: number; deliveryFee: number; userId: string }) {
    if (ctx.deliveryFee <= 0) return null;
    const candidates = (
      await this.db
        .select()
        .from(coupons)
        .where(and(eq(coupons.isActive, true), eq(coupons.discountType, 'free_delivery')))
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

  // Kept for app builds that validate before checkout. The delivery fee isn't
  // known here, so a free-delivery voucher reports ₹0 until a quote prices it.
  async validate(code: string, subtotal: number, userId?: string) {
    const res = await this.evaluate(code, { subtotal, deliveryFee: Number.POSITIVE_INFINITY, userId });
    if (res.valid && res.coupon?.discountType === 'free_delivery') {
      return { ...res, discount: 0 };
    }
    return res;
  }
}
