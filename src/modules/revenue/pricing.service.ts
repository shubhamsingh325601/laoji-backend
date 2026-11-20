import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { deliveryMinOrderTiers, pricingSettings } from '../../../drizzle/schema';
import { NewCustomerDeliveryService } from './new-customer-delivery.service';
import { RevenueConfigService, type ResolvedRevenueConfig } from './revenue-config.service';

export interface PricingSettings {
  /** Drops farther than this from the service area's centre pay the outer-zone fee. */
  outerZoneRadiusKm: number;
  outerZoneFee: number;
  /** Beyond this distance free delivery needs at least longDistanceFreeMin. */
  longDistanceKm: number;
  longDistanceFreeMin: number;
}

// What was hardcoded before it became admin-editable; used until saved.
export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  outerZoneRadiusKm: 2,
  outerZoneFee: 15,
  longDistanceKm: 5,
  longDistanceFreeMin: 200,
};

export interface MinOrderTier {
  fromKm: number;
  toKm: number | null; // null = no upper limit
  minOrderAmount: number;
}

const MAX_TIERS = 20;

export function validatePricingSettings(input: unknown): PricingSettings {
  const i = (input ?? {}) as Record<string, unknown>;
  const num = (key: keyof PricingSettings, label: string, min: number, max: number) => {
    const n = Number(i[key]);
    if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`${label} must be between ${min} and ${max}`);
    return Math.round(n * 100) / 100;
  };
  return {
    outerZoneRadiusKm: num('outerZoneRadiusKm', 'Outer zone distance (km)', 0, 100),
    outerZoneFee: num('outerZoneFee', 'Outer zone fee', 0, 1000),
    longDistanceKm: num('longDistanceKm', 'Long distance (km)', 0, 100),
    longDistanceFreeMin: num('longDistanceFreeMin', 'Long distance free-delivery minimum', 0, 100000),
  };
}

/** Bands must start at 0 km, join up one after another and end open-ended. */
export function validateMinOrderTiers(tiers: unknown): MinOrderTier[] {
  if (!Array.isArray(tiers) || tiers.length === 0) throw new BadRequestException('Add at least one distance band');
  if (tiers.length > MAX_TIERS) throw new BadRequestException(`At most ${MAX_TIERS} bands are allowed`);
  const out = tiers.map((t: any, i) => {
    const label = `Band ${i + 1}`;
    const fromKm = Number(t?.fromKm);
    const toKm = t?.toKm === null || t?.toKm === undefined ? null : Number(t.toKm);
    const minOrderAmount = Number(t?.minOrderAmount);
    if (!Number.isFinite(fromKm) || fromKm < 0) throw new BadRequestException(`${label}: "from" km must be 0 or more`);
    if (toKm !== null && (!Number.isFinite(toKm) || toKm <= fromKm)) {
      throw new BadRequestException(`${label}: "to" km must be greater than "from" km`);
    }
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      throw new BadRequestException(`${label}: minimum order must be 0 or more`);
    }
    return { fromKm, toKm, minOrderAmount: Math.round(minOrderAmount * 100) / 100 };
  });
  if (out[0].fromKm !== 0) throw new BadRequestException('The first band must start at 0 km');
  out.forEach((band, i) => {
    const last = i === out.length - 1;
    if (last && band.toKm !== null) throw new BadRequestException('The last band must have no upper limit');
    if (!last) {
      if (band.toKm === null) throw new BadRequestException(`Band ${i + 1}: only the last band can have no upper limit`);
      if (out[i + 1].fromKm !== band.toKm) {
        throw new BadRequestException(`Band ${i + 2} must start at ${band.toKm} km, with no gaps or overlaps`);
      }
    }
  });
  return out;
}

/** The band a distance falls in: (from, to], the first band also holding 0 km. */
export function minOrderForDistance(tiers: MinOrderTier[], distanceKm: number): number | null {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.fromKm - b.fromKm);
  const hit = sorted.find((t, i) => (i === 0 || distanceKm > t.fromKm) && (t.toKm === null || distanceKm <= t.toKm));
  return (hit ?? sorted[sorted.length - 1]).minOrderAmount;
}

@Injectable()
export class PricingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly newCustomerDelivery: NewCustomerDeliveryService,
    private readonly revenueConfig: RevenueConfigService,
  ) {}

  async getSettings(): Promise<PricingSettings> {
    const [row] = await this.db.select().from(pricingSettings).limit(1);
    return row
      ? {
          outerZoneRadiusKm: row.outerZoneRadiusKm,
          outerZoneFee: row.outerZoneFee,
          longDistanceKm: row.longDistanceKm,
          longDistanceFreeMin: row.longDistanceFreeMin,
        }
      : DEFAULT_PRICING_SETTINGS;
  }

  async saveSettings(input: unknown): Promise<PricingSettings> {
    const valid = validatePricingSettings(input);
    await this.db.transaction(async (tx) => {
      await tx.delete(pricingSettings);
      await tx.insert(pricingSettings).values(valid);
    });
    return valid;
  }

  /** Empty means the admin hasn't set bands, so revenue_config's minimum applies at every distance. */
  async listMinOrderTiers(): Promise<MinOrderTier[]> {
    const rows = await this.db.select().from(deliveryMinOrderTiers).orderBy(asc(deliveryMinOrderTiers.fromKm));
    return rows.map((r) => ({ fromKm: r.fromKm, toKm: r.toKm, minOrderAmount: r.minOrderAmount }));
  }

  /** An empty list clears the bands. */
  async replaceMinOrderTiers(tiers: unknown): Promise<MinOrderTier[]> {
    if (Array.isArray(tiers) && tiers.length === 0) {
      await this.db.delete(deliveryMinOrderTiers);
      return [];
    }
    const valid = validateMinOrderTiers(tiers);
    await this.db.transaction(async (tx) => {
      await tx.delete(deliveryMinOrderTiers);
      await tx.insert(deliveryMinOrderTiers).values(valid);
    });
    return valid;
  }

  /** Smallest item subtotal for a drop this far away. */
  async minOrderValue(distanceKm: number, globalMin: number): Promise<number> {
    return minOrderForDistance(await this.listMinOrderTiers(), distanceKm) ?? globalMin;
  }

  /**
   * The delivery side of a price: minimum order, free-delivery threshold and
   * fee for a drop `distanceKm` away. One place for checkout and the admin
   * preview, so what an admin sees is what customers are charged.
   * `offerApplied` is the new-customer free-delivery offer.
   */
  async deliveryQuote(args: {
    revenue: ResolvedRevenueConfig;
    distanceKm: number;
    subtotal: number;
    outerZone: boolean;
    offerApplied: boolean;
  }) {
    const { distanceKm, subtotal } = args;
    const settings = await this.getSettings();
    let revenue = args.revenue;
    // Beyond the long distance, free delivery needs a larger order, whatever
    // lower threshold the vendor's rule sets.
    if (distanceKm > settings.longDistanceKm) {
      revenue = { ...revenue, freeDeliveryThreshold: Math.max(revenue.freeDeliveryThreshold, settings.longDistanceFreeMin) };
    }
    // Per-distance thresholds the admin saved win over the single global one.
    const freeDeliveryThreshold = await this.newCustomerDelivery.freeDeliveryThreshold(distanceKm, revenue.freeDeliveryThreshold);
    const minOrderValue = await this.minOrderValue(distanceKm, revenue.minOrderValue);
    revenue = { ...revenue, freeDeliveryThreshold, minOrderValue };

    let baseFee = 0;
    if (!args.offerApplied && subtotal < freeDeliveryThreshold) {
      baseFee =
        (await this.newCustomerDelivery.feeForDistance(distanceKm)) ??
        this.revenueConfig.calculateDeliveryFee(revenue, subtotal, distanceKm);
    }
    // A fee of 0 (threshold reached or new-customer offer) stays free.
    const deliveryFee = args.outerZone && baseFee > 0 ? settings.outerZoneFee : baseFee;
    return { revenue, minOrderValue, freeDeliveryThreshold, baseFee, deliveryFee };
  }

  /** Admin preview: what a customer who is not on the free-delivery offer would pay. */
  async preview(distanceKm: number, subtotal: number, outerZone: boolean) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(subtotal) || subtotal < 0) {
      throw new BadRequestException('Distance and order amount must be 0 or more');
    }
    const revenue = await this.revenueConfig.resolve('', null);
    const q = await this.deliveryQuote({ revenue, distanceKm, subtotal, outerZone, offerApplied: false });
    return {
      distanceKm,
      subtotal,
      outerZone,
      minOrderValue: q.minOrderValue,
      belowMinimum: subtotal < q.minOrderValue,
      freeDeliveryThreshold: q.freeDeliveryThreshold,
      deliveryFee: q.deliveryFee,
      total: subtotal + q.deliveryFee,
    };
  }
}
