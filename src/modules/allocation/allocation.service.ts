import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  addresses,
  allocationAttempts,
  groceryOrderItems,
  groceryOrders,
  orderStatusHistory,
  vendorProducts,
  vendors,
} from '../../../drizzle/schema';
import { haversineKm } from '../catalog/catalog.types';
import { JobQueueService } from './job-queue.service';
import { ALLOCATION_SLA_SECONDS, MAX_ALLOCATION_ATTEMPTS } from './allocation.constants';

export interface CartLine {
  productId: string;
  qty: number;
}

export interface AllocationCandidate {
  vendorId: string;
  unitPrices: Map<string, number>;
}

@Injectable()
export class AllocationService {
  private readonly logger = new Logger(AllocationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly jobQueue: JobQueueService,
  ) {}

  /**
   * The waterfall (TRD Section 4.1 / 7.2), implemented as far as a
   * phase-sized feature reasonably goes:
   *   1. Single vendor covers the whole cart (by construction below — a
   *      vendor is only a candidate if every line item is in stock with
   *      them).
   *   2. Filtered to their own configured pickup radius (Haversine).
   *   3. Lowest combined cost wins.
   *   4. Fastest (closest) as the tiebreaker.
   * "Minimum vendor combination" (splitting a cart across multiple
   * vendors when no single vendor covers it) is NOT implemented — a real
   * bin-packing problem, not attempted here. No single-vendor match means
   * this returns null and the caller must fail the checkout/reallocation
   * cleanly rather than guess at a split.
   */
  async findBestVendor(
    items: CartLine[],
    lat: number,
    lng: number,
    excludeVendorIds: string[] = [],
  ): Promise<AllocationCandidate | null> {
    const allVendors = await this.db.select().from(vendors);
    const inRadius = allVendors.filter(
      (v) =>
        v.type !== 'restaurant' &&
        !excludeVendorIds.includes(v.id) &&
        haversineKm(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm,
    );
    if (inRadius.length === 0) return null;

    const productIds = items.map((i) => i.productId);
    const candidates: { vendorId: string; totalCost: number; distance: number; prices: Map<string, number> }[] = [];

    for (const vendor of inRadius) {
      const rows = await this.db
        .select()
        .from(vendorProducts)
        .where(and(eq(vendorProducts.vendorId, vendor.id), inArray(vendorProducts.productId, productIds)));

      const byProduct = new Map(rows.map((r) => [r.productId, r]));
      const canFulfillAll = items.every((line) => {
        const vp = byProduct.get(line.productId);
        return vp && vp.isAvailable && vp.stockQty >= line.qty;
      });
      if (!canFulfillAll) continue;

      const totalCost = items.reduce((sum, line) => sum + byProduct.get(line.productId)!.price * line.qty, 0);
      candidates.push({
        vendorId: vendor.id,
        totalCost,
        distance: haversineKm(lat, lng, vendor.pickupLat, vendor.pickupLng),
        prices: new Map(rows.map((r) => [r.productId, r.price])),
      });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.totalCost - b.totalCost || a.distance - b.distance);
    const winner = candidates[0];
    return { vendorId: winner.vendorId, unitPrices: winner.prices };
  }

  /** Creates the pending allocation_attempts row and schedules its SLA timeout. */
  async createAttempt(groceryOrderId: string, vendorId: string, attemptNo: number) {
    const slaDeadline = new Date(Date.now() + ALLOCATION_SLA_SECONDS * 1000);
    const [attempt] = await this.db
      .insert(allocationAttempts)
      .values({ groceryOrderId, vendorId, attemptNo, outcome: 'pending', slaDeadline })
      .returning();

    this.jobQueue.schedule(attempt.id, ALLOCATION_SLA_SECONDS * 1000, () => this.handleTimeout(attempt.id));
    return attempt;
  }

  async handleTimeout(attemptId: string) {
    const [attempt] = await this.db.select().from(allocationAttempts).where(eq(allocationAttempts.id, attemptId)).limit(1);
    if (!attempt || attempt.outcome !== 'pending') return; // already resolved by accept/reject

    this.logger.log(`Allocation attempt ${attemptId} timed out (vendor ${attempt.vendorId})`);
    await this.db.update(allocationAttempts).set({ outcome: 'timeout' }).where(eq(allocationAttempts.id, attemptId));
    await this.reallocate(attempt.groceryOrderId);
  }

  /** Vendor explicitly rejects — reallocates immediately, no need to wait for the SLA timeout. */
  async handleRejection(attemptId: string) {
    this.jobQueue.cancel(attemptId);
    await this.db.update(allocationAttempts).set({ outcome: 'rejected' }).where(eq(allocationAttempts.id, attemptId));
    const [attempt] = await this.db.select().from(allocationAttempts).where(eq(allocationAttempts.id, attemptId)).limit(1);
    if (attempt) await this.reallocate(attempt.groceryOrderId);
  }

  handleAcceptance(attemptId: string) {
    this.jobQueue.cancel(attemptId);
    return this.db.update(allocationAttempts).set({ outcome: 'accepted' }).where(eq(allocationAttempts.id, attemptId));
  }

  /**
   * Silent reallocation (TRD Section 7.2) — invisible to the customer, only
   * ever recorded in allocation_attempts (Admin-visible ops trail), never
   * in order_status_history (that's the customer-facing timeline).
   */
  private async reallocate(groceryOrderId: string) {
    const [order] = await this.db.select().from(groceryOrders).where(eq(groceryOrders.id, groceryOrderId)).limit(1);
    if (!order || order.status !== 'placed') return; // already moved on (e.g. cancelled)

    const previousAttempts = await this.db
      .select()
      .from(allocationAttempts)
      .where(eq(allocationAttempts.groceryOrderId, groceryOrderId))
      .orderBy(desc(allocationAttempts.attemptNo));

    const nextAttemptNo = (previousAttempts[0]?.attemptNo ?? 0) + 1;
    if (nextAttemptNo > MAX_ALLOCATION_ATTEMPTS) {
      await this.markFailed(groceryOrderId);
      return;
    }

    const items = await this.db.select().from(groceryOrderItems).where(eq(groceryOrderItems.groceryOrderId, groceryOrderId));
    const [address] = await this.db.select().from(addresses).where(eq(addresses.id, order.deliveryAddressId)).limit(1);
    if (!address) {
      await this.markFailed(groceryOrderId);
      return;
    }

    const excludeVendorIds = previousAttempts.map((a) => a.vendorId);
    const candidate = await this.findBestVendor(
      items.map((i) => ({ productId: i.productId, qty: i.qty })),
      address.lat,
      address.lng,
      excludeVendorIds,
    );

    if (!candidate) {
      await this.markFailed(groceryOrderId);
      return;
    }

    const subtotal = items.reduce((sum, i) => sum + (candidate.unitPrices.get(i.productId) ?? 0) * i.qty, 0);
    await this.db
      .update(groceryOrders)
      .set({ vendorId: candidate.vendorId, subtotal, total: subtotal + order.deliveryFee })
      .where(eq(groceryOrders.id, groceryOrderId));

    for (const item of items) {
      const price = candidate.unitPrices.get(item.productId);
      if (price !== undefined) {
        await this.db.update(groceryOrderItems).set({ unitPrice: price }).where(eq(groceryOrderItems.id, item.id));
      }
    }

    await this.createAttempt(groceryOrderId, candidate.vendorId, nextAttemptNo);
  }

  private async markFailed(groceryOrderId: string) {
    await this.db.update(groceryOrders).set({ status: 'failed' }).where(eq(groceryOrders.id, groceryOrderId));
    await this.db.insert(orderStatusHistory).values({
      groceryOrderId,
      status: 'failed',
      actorRole: 'system',
    });
  }
}
