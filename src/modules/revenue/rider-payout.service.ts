import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { asc, eq, isNull, and } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { addresses, foodOrders, groceryOrders, restaurants, riderPayoutTiers, vendors } from '../../../drizzle/schema';
import { haversineKm } from '../catalog/catalog.types';

type OrderType = 'grocery' | 'food';

export interface RiderPayoutTier {
  fromKm: number;
  toKm: number | null; // null = no upper limit
  amount: number;
}

// Used until the admin saves their own ranges.
export const DEFAULT_RIDER_PAYOUT_TIERS: RiderPayoutTier[] = [
  { fromKm: 0, toKm: 3, amount: 5 },
  { fromKm: 3, toKm: 5, amount: 10 },
  { fromKm: 5, toKm: null, amount: 15 },
];

const MAX_TIERS = 20;

/** Throws if the ranges don't start at 0, join up one after another and end open-ended. */
export function validateRiderPayoutTiers(tiers: unknown): RiderPayoutTier[] {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new BadRequestException('Add at least one distance range');
  }
  if (tiers.length > MAX_TIERS) throw new BadRequestException(`At most ${MAX_TIERS} ranges are allowed`);

  const out: RiderPayoutTier[] = tiers.map((t, i) => {
    const fromKm = Number(t?.fromKm);
    const toKm = t?.toKm === null || t?.toKm === undefined ? null : Number(t.toKm);
    const amount = Number(t?.amount);
    const label = `Range ${i + 1}`;
    if (!Number.isFinite(fromKm) || fromKm < 0) throw new BadRequestException(`${label}: "from" km must be 0 or more`);
    if (toKm !== null && (!Number.isFinite(toKm) || toKm <= fromKm)) {
      throw new BadRequestException(`${label}: "to" km must be greater than "from" km`);
    }
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException(`${label}: amount must be 0 or more`);
    return { fromKm, toKm, amount: Math.round(amount * 100) / 100 };
  });

  if (out[0].fromKm !== 0) throw new BadRequestException('The first range must start at 0 km');
  for (let i = 0; i < out.length; i++) {
    const last = i === out.length - 1;
    if (last && out[i].toKm !== null) {
      throw new BadRequestException('The last range must have no upper limit (e.g. "5 km and above")');
    }
    if (!last) {
      if (out[i].toKm === null) throw new BadRequestException(`Range ${i + 1}: only the last range can have no upper limit`);
      if (out[i + 1].fromKm !== out[i].toKm) {
        throw new BadRequestException(`Range ${i + 2} must start at ${out[i].toKm} km, where range ${i + 1} ends — no gaps or overlaps`);
      }
    }
  }
  return out;
}

/** A range covers (fromKm, toKm]; the first one also includes 0 km, matching the customer delivery-fee tiers. */
export function riderPayoutForDistance(tiers: RiderPayoutTier[], distanceKm: number): number {
  const sorted = [...tiers].sort((a, b) => a.fromKm - b.fromKm);
  const hit = sorted.find((t, i) => (i === 0 || distanceKm > t.fromKm) && (t.toKm === null || distanceKm <= t.toKm));
  return (hit ?? sorted[sorted.length - 1]).amount;
}

@Injectable()
export class RiderPayoutService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async listTiers(): Promise<RiderPayoutTier[]> {
    const rows = await this.db.select().from(riderPayoutTiers).orderBy(asc(riderPayoutTiers.fromKm));
    if (!rows.length) return DEFAULT_RIDER_PAYOUT_TIERS;
    return rows.map((r) => ({ fromKm: r.fromKm, toKm: r.toKm, amount: r.amount }));
  }

  async replaceTiers(tiers: unknown): Promise<RiderPayoutTier[]> {
    const valid = validateRiderPayoutTiers(tiers);
    await this.db.transaction(async (tx) => {
      await tx.delete(riderPayoutTiers);
      await tx.insert(riderPayoutTiers).values(valid);
    });
    return valid;
  }

  /**
   * The delivery partner's pay for an order, from the admin's current ranges and
   * the straight-line pickup-to-drop distance. Worked out once and saved on the
   * order, so changing the ranges later never alters an order that was already
   * offered. If the distance can't be worked out (no pickup point or address),
   * the lowest range applies and nothing is saved, so a later call can retry.
   */
  async forOrder(type: OrderType, orderId: string): Promise<number> {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order) return 0;
    if (order.riderPayout !== null && order.riderPayout !== undefined) return order.riderPayout;

    const tiers = await this.listTiers();
    const km = await this.pickupToDropKm(type, order);
    if (km === null) return riderPayoutForDistance(tiers, 0);

    const amount = riderPayoutForDistance(tiers, km);
    // Only fills a blank, so two racing calls can't overwrite each other.
    await this.db.update(table).set({ riderPayout: amount }).where(and(eq(table.id, orderId), isNull(table.riderPayout)));
    return amount;
  }

  private async pickupToDropKm(
    type: OrderType,
    order: { deliveryAddressId: string; vendorId?: string | null; restaurantId?: string },
  ): Promise<number | null> {
    let vendorId: string | null | undefined = order.vendorId;
    if (type === 'food' && order.restaurantId) {
      const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
      vendorId = restaurant?.vendorId;
    }
    if (!vendorId) return null;
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const [address] = await this.db.select().from(addresses).where(eq(addresses.id, order.deliveryAddressId)).limit(1);
    if (!vendor || !address) return null;
    return haversineKm(vendor.pickupLat, vendor.pickupLng, address.lat, address.lng);
  }
}
