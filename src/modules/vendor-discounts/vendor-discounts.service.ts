import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { menuItems, products, vendorDiscountRedemptions, vendorDiscounts, vendors } from '../../../drizzle/schema';
import type { CreateVendorDiscountDto } from './dto/create-vendor-discount.dto';
import type { UpdateVendorDiscountDto } from './dto/update-vendor-discount.dto';

export type VendorDiscountRow = typeof vendorDiscounts.$inferSelect;

export function currentIstDateAndMinutes(): { dateStr: string; minutes: number } {
  const now = new Date();
  // IST is UTC + 5:30
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const dateStr = istTime.toISOString().slice(0, 10);
  const minutes = istTime.getUTCHours() * 60 + istTime.getUTCMinutes();
  return { dateStr, minutes };
}

export function parseTimeMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

@Injectable()
export class VendorDiscountsService implements OnModuleInit {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`
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

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "vendor_discount_redemptions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "discount_id" uuid NOT NULL REFERENCES "vendor_discounts"("id") ON DELETE CASCADE,
          "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "order_id" uuid,
          "created_at" timestamp with time zone NOT NULL DEFAULT now()
        );
      `);
    } catch (err) {
      console.warn('[VendorDiscountsService] Auto-migration notice:', err);
    }
  }

  async listByVendor(vendorId: string) {
    const rows = await this.db
      .select({
        discount: vendorDiscounts,
        productName: products.name,
        menuItemName: menuItems.name,
      })
      .from(vendorDiscounts)
      .leftJoin(products, eq(vendorDiscounts.productId, products.id))
      .leftJoin(menuItems, eq(vendorDiscounts.menuItemId, menuItems.id))
      .where(eq(vendorDiscounts.vendorId, vendorId))
      .orderBy(desc(vendorDiscounts.createdAt));

    return rows.map(({ discount, productName, menuItemName }) => ({
      ...discount,
      targetItemName: discount.scope === 'product' ? productName || menuItemName || 'Specific Item' : 'Entire Store',
    }));
  }

  async getById(id: string): Promise<VendorDiscountRow> {
    const [row] = await this.db.select().from(vendorDiscounts).where(eq(vendorDiscounts.id, id)).limit(1);
    if (!row) {
      throw new NotFoundException('Vendor discount not found');
    }
    return row;
  }

  async create(vendorId: string, dto: CreateVendorDiscountDto): Promise<VendorDiscountRow> {
    const [vendor] = await this.db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!dto.title?.trim()) {
      throw new BadRequestException('Discount title is required');
    }

    if (dto.scope === 'product' && !dto.productId && !dto.menuItemId) {
      throw new BadRequestException('Please select a product or menu item for product-specific discount');
    }

    const [created] = await this.db
      .insert(vendorDiscounts)
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

  async update(id: string, dto: UpdateVendorDiscountDto): Promise<VendorDiscountRow> {
    const existing = await this.getById(id);

    const updates: Partial<typeof vendorDiscounts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.title !== undefined) updates.title = dto.title.trim();
    if (dto.scope !== undefined) updates.scope = dto.scope;
    if (dto.productId !== undefined) updates.productId = dto.productId || null;
    if (dto.menuItemId !== undefined) updates.menuItemId = dto.menuItemId || null;
    if (dto.discountType !== undefined) updates.discountType = dto.discountType;
    if (dto.discountValue !== undefined) updates.discountValue = Number(dto.discountValue);
    if (dto.maxDiscount !== undefined) updates.maxDiscount = dto.maxDiscount != null ? Number(dto.maxDiscount) : null;
    if (dto.minOrderValue !== undefined) updates.minOrderValue = Number(dto.minOrderValue);
    if (dto.totalUsageLimit !== undefined) updates.totalUsageLimit = dto.totalUsageLimit != null ? Number(dto.totalUsageLimit) : null;
    if (dto.perUserLimit !== undefined) updates.perUserLimit = Number(dto.perUserLimit);
    if (dto.startTime !== undefined) updates.startTime = dto.startTime?.trim() || null;
    if (dto.endTime !== undefined) updates.endTime = dto.endTime?.trim() || null;
    if (dto.startDate !== undefined) updates.startDate = dto.startDate || null;
    if (dto.endDate !== undefined) updates.endDate = dto.endDate || null;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;

    const [updated] = await this.db
      .update(vendorDiscounts)
      .set(updates)
      .where(eq(vendorDiscounts.id, id))
      .returning();

    return updated;
  }

  async toggleActive(id: string): Promise<VendorDiscountRow> {
    const existing = await this.getById(id);
    const [updated] = await this.db
      .update(vendorDiscounts)
      .set({
        isActive: !existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(vendorDiscounts.id, id))
      .returning();

    return updated;
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    await this.getById(id);
    await this.db.delete(vendorDiscounts).where(eq(vendorDiscounts.id, id));
    return { success: true, message: 'Vendor discount deleted successfully' };
  }

  /**
   * Evaluates which vendor discounts are currently active and available.
   * Validates:
   * - isActive flag
   * - Total usage limit (usageCount < totalUsageLimit)
   * - Date range (startDate <= today <= endDate)
   * - Daily time window (startTime <= currentTime <= endTime in IST)
   * - Per-user redemption limit (if userId is given)
   */
  async getActiveDiscountsForVendor(vendorId: string, userId?: string): Promise<VendorDiscountRow[]> {
    const rows = await this.db
      .select()
      .from(vendorDiscounts)
      .where(and(eq(vendorDiscounts.vendorId, vendorId), eq(vendorDiscounts.isActive, true)));

    if (rows.length === 0) return [];

    const { dateStr: today, minutes: currentMinutes } = currentIstDateAndMinutes();

    // If userId is provided, get count of redemptions per discount
    const userRedemptionsMap = new Map<string, number>();
    if (userId) {
      const redemptions = await this.db
        .select({ discountId: vendorDiscountRedemptions.discountId })
        .from(vendorDiscountRedemptions)
        .where(
          and(
            eq(vendorDiscountRedemptions.vendorId, vendorId),
            eq(vendorDiscountRedemptions.userId, userId),
          ),
        );
      for (const r of redemptions) {
        userRedemptionsMap.set(r.discountId, (userRedemptionsMap.get(r.discountId) ?? 0) + 1);
      }
    }

    return rows.filter((d) => {
      // 1. Total usage limit check
      if (d.totalUsageLimit != null && d.usageCount >= d.totalUsageLimit) {
        return false;
      }

      // 2. Per-user limit check
      if (userId && d.perUserLimit != null) {
        const usedByUser = userRedemptionsMap.get(d.id) ?? 0;
        if (usedByUser >= d.perUserLimit) {
          return false;
        }
      }

      // 3. Date range check
      if (d.startDate && today < d.startDate) return false;
      if (d.endDate && today > d.endDate) return false;

      // 4. Daily time slot check (in IST)
      const startMin = parseTimeMinutes(d.startTime);
      const endMin = parseTimeMinutes(d.endTime);
      if (startMin != null && endMin != null) {
        if (startMin <= endMin) {
          if (currentMinutes < startMin || currentMinutes > endMin) return false;
        } else {
          // Window crosses midnight (e.g. 22:00 to 02:00)
          if (currentMinutes < startMin && currentMinutes > endMin) return false;
        }
      }

      return true;
    });
  }

  /**
   * Applies the best eligible vendor discount for a given item.
   * Returns original price, discounted price, and discount label.
   */
  calculateItemDiscount(
    itemPrice: number,
    discounts: VendorDiscountRow[],
    itemTarget: { productId?: string; menuItemId?: string },
  ): { originalPrice: number; price: number; discountLabel: string | null; discountApplied: VendorDiscountRow | null } {
    let bestDiscountAmount = 0;
    let bestDiscount: VendorDiscountRow | null = null;
    let bestLabel: string | null = null;

    for (const d of discounts) {
      // Check match by scope
      let isMatch = false;
      if (d.scope === 'entire_store') {
        isMatch = true;
      } else if (d.scope === 'product') {
        if (d.productId && itemTarget.productId && d.productId === itemTarget.productId) {
          isMatch = true;
        } else if (d.menuItemId && itemTarget.menuItemId && d.menuItemId === itemTarget.menuItemId) {
          isMatch = true;
        }
      }

      if (!isMatch) continue;

      let amount = 0;
      let label = '';
      if (d.discountType === 'percentage') {
        const raw = (itemPrice * d.discountValue) / 100;
        amount = d.maxDiscount ? Math.min(raw, d.maxDiscount) : raw;
        label = `↓${Math.round(d.discountValue)}% OFF`;
      } else if (d.discountType === 'flat') {
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

  /**
   * Records redemption when an order is placed.
   */
  async recordRedemption(discountId: string, vendorId: string, userId: string, orderId?: string) {
    try {
      await this.db.insert(vendorDiscountRedemptions).values({
        discountId,
        vendorId,
        userId,
        orderId: orderId || null,
      });

      await this.db
        .update(vendorDiscounts)
        .set({
          usageCount: sql`${vendorDiscounts.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(vendorDiscounts.id, discountId));
    } catch (err) {
      console.warn('[VendorDiscountsService] Failed to record redemption:', err);
    }
  }
}
