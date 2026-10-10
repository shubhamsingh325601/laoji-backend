import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, notInArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { foodOrders, groceryOrders, newCustomerDeliverySettings } from '../../../drizzle/schema';

export interface NewCustomerDeliverySettings {
  enabled: boolean;
  maxKm: number;
  maxOrders: number;
}

// Used until the admin saves their own.
export const DEFAULT_NEW_CUSTOMER_DELIVERY: NewCustomerDeliverySettings = { enabled: true, maxKm: 5, maxOrders: 3 };

export function validateNewCustomerDelivery(input: unknown): NewCustomerDeliverySettings {
  const i = (input ?? {}) as Record<string, unknown>;
  const maxKm = Number(i.maxKm);
  const maxOrders = Number(i.maxOrders);
  if (typeof i.enabled !== 'boolean') throw new BadRequestException('"enabled" must be true or false');
  if (!Number.isFinite(maxKm) || maxKm <= 0) throw new BadRequestException('Distance limit must be more than 0 km');
  if (!Number.isInteger(maxOrders) || maxOrders < 1) throw new BadRequestException('Number of orders must be a whole number, 1 or more');
  return { enabled: i.enabled, maxKm: Math.round(maxKm * 100) / 100, maxOrders };
}

@Injectable()
export class NewCustomerDeliveryService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

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

  /**
   * True when this order is one of the customer's first few (failed and
   * cancelled orders don't count) and the drop is within the distance limit.
   */
  async qualifies(customerId: string, distanceKm: number): Promise<boolean> {
    const rule = await this.get();
    if (!rule.enabled || distanceKm > rule.maxKm) return false;

    const notCounted = ['failed', 'cancelled'] as const;
    const [[g], [f]] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(groceryOrders)
        .where(and(eq(groceryOrders.customerId, customerId), notInArray(groceryOrders.status, [...notCounted]))),
      this.db
        .select({ n: count() })
        .from(foodOrders)
        .where(and(eq(foodOrders.customerId, customerId), notInArray(foodOrders.status, [...notCounted]))),
    ]);
    return (g?.n ?? 0) + (f?.n ?? 0) < rule.maxOrders;
  }
}
