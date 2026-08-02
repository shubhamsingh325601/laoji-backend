import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { deliveryPartners, foodOrders, groceryOrders, restaurants, settlements, vendors } from '../../../drizzle/schema';

type OrderType = 'grocery' | 'food';

@Injectable()
export class SettlementService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  // Small local identity lookups rather than importing CatalogModule/
  // DeliveryModule here — both of those already import RevenueModule (for
  // config resolution / settlement generation), so importing back would
  // be circular. These are the only two fields either module's own
  // requireVendor/requirePartner equivalents would return that this
  // service actually needs.
  async vendorIdForUser(userId: string): Promise<string> {
    const [row] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    if (!row) throw new NotFoundException('Vendor profile not set up yet');
    return row.id;
  }

  async partnerIdForUser(userId: string): Promise<string> {
    const [row] = await this.db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!row) throw new NotFoundException('Delivery partner profile not set up yet');
    return row.id;
  }

  // Reuses the exact hook Phase 5/6 already fire from — DeliveryService's
  // OTP-verified delivered transition — same pattern as Phase 6's COD
  // auto-collect and Phase 7's notification dispatch, not a new one.
  // Vendor keeps subtotal minus platform's cut; the delivery partner keeps
  // the whole delivery fee (same "deliveryFee as earnings" precedent
  // Phase 5's frontend already used before real settlements existed).
  async generateForDeliveredOrder(type: OrderType, orderId: string) {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order) return null;

    const [settlement] = await this.db
      .insert(settlements)
      .values({
        ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
        vendorPayout: order.subtotal - order.platformCommission,
        deliveryPayout: order.deliveryFee,
        platformShare: order.platformCommission,
        commissionPctSnapshot: order.commissionPct,
      })
      .returning();
    return settlement;
  }

  async listForVendor(vendorId: string) {
    const groceryRows = await this.db.select().from(groceryOrders).where(eq(groceryOrders.vendorId, vendorId));
    const restaurantRows = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendorId));
    const foodRows = restaurantRows.length
      ? await this.db.select().from(foodOrders).where(inArray(foodOrders.restaurantId, restaurantRows.map((r) => r.id)))
      : [];

    const groceryIds = groceryRows.map((o) => o.id);
    const foodIds = foodRows.map((o) => o.id);
    if (!groceryIds.length && !foodIds.length) return [];

    const [gSettlements, fSettlements] = await Promise.all([
      groceryIds.length ? this.db.select().from(settlements).where(inArray(settlements.groceryOrderId, groceryIds)) : [],
      foodIds.length ? this.db.select().from(settlements).where(inArray(settlements.foodOrderId, foodIds)) : [],
    ]);

    return [...gSettlements, ...fSettlements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((s) => this.toSummary(s));
  }

  async listForPartner(partnerId: string) {
    const groceryRows = await this.db.select().from(groceryOrders).where(eq(groceryOrders.deliveryPartnerId, partnerId));
    const foodRows = await this.db.select().from(foodOrders).where(eq(foodOrders.deliveryPartnerId, partnerId));
    const groceryIds = groceryRows.map((o) => o.id);
    const foodIds = foodRows.map((o) => o.id);
    if (!groceryIds.length && !foodIds.length) return [];

    const [gSettlements, fSettlements] = await Promise.all([
      groceryIds.length ? this.db.select().from(settlements).where(inArray(settlements.groceryOrderId, groceryIds)) : [],
      foodIds.length ? this.db.select().from(settlements).where(inArray(settlements.foodOrderId, foodIds)) : [],
    ]);

    return [...gSettlements, ...fSettlements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((s) => this.toSummary(s));
  }

  private toSummary(s: typeof settlements.$inferSelect) {
    return {
      id: s.id,
      type: (s.groceryOrderId ? 'grocery' : 'food') as OrderType,
      orderId: (s.groceryOrderId ?? s.foodOrderId)!,
      orderCode: (s.groceryOrderId ?? s.foodOrderId)!.slice(0, 8).toUpperCase(),
      vendorPayout: s.vendorPayout,
      deliveryPayout: s.deliveryPayout,
      platformShare: s.platformShare,
      commissionPctSnapshot: s.commissionPctSnapshot,
      createdAt: s.createdAt,
    };
  }

  // ---------- Admin ----------

  async listAllForAdmin() {
    const rows = await this.db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(200);
    return rows.map((s) => this.toSummary(s));
  }
}
