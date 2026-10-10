import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, notInArray, or } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  customerDeliveryFeeTiers,
  customerFreeDeliveryBonus,
  foodOrders,
  groceryOrders,
  newCustomerDeliverySettings,
  users,
} from '../../../drizzle/schema';
import { riderPayoutForDistance, validateRiderPayoutTiers, type RiderPayoutTier } from './rider-payout.service';

export interface NewCustomerDeliverySettings {
  enabled: boolean;
  maxKm: number;
  maxOrders: number;
}

// What the customer pays by distance. Same shape as the rider payout ranges.
export type DeliveryFeeTier = RiderPayoutTier;

// Used until the admin saves their own.
export const DEFAULT_NEW_CUSTOMER_DELIVERY: NewCustomerDeliverySettings = { enabled: true, maxKm: 5, maxOrders: 3 };

export interface FreeDeliveryOffer {
  /** This order's delivery is free under the new-customer offer. */
  applied: boolean;
  /** Free deliveries the customer still has before this order is counted. */
  remaining: number;
}

export interface CustomerFreeDeliveryStatus {
  customerId: string;
  name: string | null;
  phone: string | null;
  ordersPlaced: number;
  allowed: number; // standard number + admin-granted extras
  extraGranted: number;
  remaining: number;
}

export function validateNewCustomerDelivery(input: unknown): NewCustomerDeliverySettings {
  const i = (input ?? {}) as Record<string, unknown>;
  const maxKm = Number(i.maxKm);
  const maxOrders = Number(i.maxOrders);
  if (typeof i.enabled !== 'boolean') throw new BadRequestException('"enabled" must be true or false');
  if (!Number.isFinite(maxKm) || maxKm <= 0) throw new BadRequestException('Distance limit must be more than 0 km');
  if (!Number.isInteger(maxOrders) || maxOrders < 0) throw new BadRequestException('Number of orders must be a whole number, 0 or more');
  return { enabled: i.enabled, maxKm: Math.round(maxKm * 100) / 100, maxOrders };
}

// Failed and cancelled orders never reached the customer, so they don't use up a free delivery.
const NOT_COUNTED = ['failed', 'cancelled'] as const;

@Injectable()
export class NewCustomerDeliveryService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  // ---------- Offer settings ----------

  async get(): Promise<NewCustomerDeliverySettings> {
    const [row] = await this.db.select().from(newCustomerDeliverySettings).limit(1);
    return row ? { enabled: row.enabled, maxKm: row.maxKm, maxOrders: row.maxOrders } : DEFAULT_NEW_CUSTOMER_DELIVERY;
  }

  async save(input: unknown): Promise<NewCustomerDeliverySettings> {
    const valid = validateNewCustomerDelivery(input);
    await this.db.transaction(async (tx) => {
      await tx.delete(newCustomerDeliverySettings);
      await tx.insert(newCustomerDeliverySettings).values(valid);
    });
    return valid;
  }

  // ---------- Customer delivery fee ranges ----------

  /** Empty means the admin hasn't set ranges, so the revenue-config fees apply. */
  async listFeeTiers(): Promise<DeliveryFeeTier[]> {
    const rows = await this.db.select().from(customerDeliveryFeeTiers).orderBy(asc(customerDeliveryFeeTiers.fromKm));
    return rows.map((r) => ({ fromKm: r.fromKm, toKm: r.toKm, amount: r.amount }));
  }

  async replaceFeeTiers(tiers: unknown): Promise<DeliveryFeeTier[]> {
    const valid = validateRiderPayoutTiers(tiers);
    await this.db.transaction(async (tx) => {
      await tx.delete(customerDeliveryFeeTiers);
      await tx.insert(customerDeliveryFeeTiers).values(valid);
    });
    return valid;
  }

  /** The admin's fee for this distance, or null when no ranges are saved. */
  async feeForDistance(distanceKm: number): Promise<number | null> {
    const tiers = await this.listFeeTiers();
    return tiers.length ? riderPayoutForDistance(tiers, distanceKm) : null;
  }

  // ---------- Free deliveries ----------

  private async ordersPlaced(customerIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!customerIds.length) return out;
    const [g, f] = await Promise.all([
      this.db
        .select({ id: groceryOrders.customerId, n: count() })
        .from(groceryOrders)
        .where(and(inArray(groceryOrders.customerId, customerIds), notInArray(groceryOrders.status, [...NOT_COUNTED])))
        .groupBy(groceryOrders.customerId),
      this.db
        .select({ id: foodOrders.customerId, n: count() })
        .from(foodOrders)
        .where(and(inArray(foodOrders.customerId, customerIds), notInArray(foodOrders.status, [...NOT_COUNTED])))
        .groupBy(foodOrders.customerId),
    ]);
    for (const r of [...g, ...f]) out.set(r.id, (out.get(r.id) ?? 0) + r.n);
    return out;
  }

  private async extras(customerIds: string[]): Promise<Map<string, number>> {
    if (!customerIds.length) return new Map();
    const rows = await this.db.select().from(customerFreeDeliveryBonus).where(inArray(customerFreeDeliveryBonus.customerId, customerIds));
    return new Map(rows.map((r) => [r.customerId, r.extraOrders]));
  }

  /**
   * Whether this order's delivery is free, and how many free deliveries the
   * customer had left. Free when the offer is on, the drop is within the
   * distance limit and the customer hasn't used all their free orders.
   */
  async offerFor(customerId: string, distanceKm: number): Promise<FreeDeliveryOffer> {
    const rule = await this.get();
    if (!rule.enabled) return { applied: false, remaining: 0 };
    const [placed, extra] = await Promise.all([this.ordersPlaced([customerId]), this.extras([customerId])]);
    const remaining = Math.max(0, rule.maxOrders + (extra.get(customerId) ?? 0) - (placed.get(customerId) ?? 0));
    return { applied: remaining > 0 && distanceKm <= rule.maxKm, remaining };
  }

  /** Customers with their free deliveries used and left, newest first; `search` matches phone or name. */
  async listCustomers(search?: string): Promise<{ settings: NewCustomerDeliverySettings; customers: CustomerFreeDeliveryStatus[] }> {
    const rule = await this.get();
    const term = search?.trim();
    const where = term
      ? and(eq(users.role, 'customer'), or(ilike(users.phone, `%${term}%`), ilike(users.name, `%${term}%`)))
      : eq(users.role, 'customer');
    const rows = await this.db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(50);
    return { settings: rule, customers: await this.statuses(rows, rule) };
  }

  private async statuses(rows: { id: string; name: string | null; phone: string | null }[], rule: NewCustomerDeliverySettings) {
    const ids = rows.map((r) => r.id);
    const [placed, extra] = await Promise.all([this.ordersPlaced(ids), this.extras(ids)]);
    return rows.map((u): CustomerFreeDeliveryStatus => {
      const extraGranted = extra.get(u.id) ?? 0;
      const ordersPlaced = placed.get(u.id) ?? 0;
      const allowed = rule.maxOrders + extraGranted;
      return {
        customerId: u.id,
        name: u.name,
        phone: u.phone,
        ordersPlaced,
        allowed,
        extraGranted,
        remaining: rule.enabled ? Math.max(0, allowed - ordersPlaced) : 0,
      };
    });
  }

  /** Sets how many extra free deliveries one customer gets on top of the standard number. */
  async setExtra(customerId: string, extraOrders: unknown): Promise<CustomerFreeDeliveryStatus> {
    const extra = Number(extraOrders);
    if (!Number.isInteger(extra) || extra < 0 || extra > 100) {
      throw new BadRequestException('Extra free deliveries must be a whole number from 0 to 100');
    }
    const [user] = await this.db.select().from(users).where(and(eq(users.id, customerId), eq(users.role, 'customer'))).limit(1);
    if (!user) throw new NotFoundException('Customer not found');
    await this.db
      .insert(customerFreeDeliveryBonus)
      .values({ customerId, extraOrders: extra })
      .onConflictDoUpdate({ target: customerFreeDeliveryBonus.customerId, set: { extraOrders: extra, updatedAt: new Date() } });
    const [status] = await this.statuses([user], await this.get());
    return status;
  }
}
