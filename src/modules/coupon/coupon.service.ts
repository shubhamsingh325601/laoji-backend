import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { coupons, foodOrders, groceryOrders } from '../../../drizzle/schema';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async listAllForAdmin() {
    return this.db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async listActive() {
    return this.db
      .select({
        id: coupons.id,
        code: coupons.code,
        discountType: coupons.discountType,
        discountValue: coupons.discountValue,
        minOrderValue: coupons.minOrderValue,
        maxDiscount: coupons.maxDiscount,
        description: coupons.description,
        isFirstOrderOnly: coupons.isFirstOrderOnly,
      })
      .from(coupons)
      .where(eq(coupons.isActive, true))
      .orderBy(desc(coupons.createdAt));
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

  async validate(code: string, subtotal: number, userId?: string) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, message: 'Please enter a coupon code', discount: 0 };
    }

    const [coupon] = await this.db.select().from(coupons).where(eq(coupons.code, cleanCode));
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
          .select({ id: groceryOrders.id })
          .from(groceryOrders)
          .where(
            and(
              eq(groceryOrders.customerId, userId),
              notInArray(groceryOrders.status, ['cancelled', 'failed']),
            ),
          )
          .limit(1);

        const existingFood = await this.db
          .select({ id: foodOrders.id })
          .from(foodOrders)
          .where(
            and(
              eq(foodOrders.customerId, userId),
              notInArray(foodOrders.status, ['cancelled', 'failed']),
            ),
          )
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
    } else if (coupon.discountType === 'flat') {
      discount = Math.min(coupon.discountValue, subtotal);
    } else if (coupon.discountType === 'free_delivery') {
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
}
