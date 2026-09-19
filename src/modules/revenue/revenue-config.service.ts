import { Inject, Injectable } from '@nestjs/common';
import { desc, inArray, lte } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { revenueConfig, users } from '../../../drizzle/schema';
import type { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';

export interface ResolvedRevenueConfig {
  commissionPct: number;
  deliveryFeeFlat: number;
  freeDeliveryThreshold: number;
  deliveryFeeTier1: number; // <= 3km
  deliveryFeeTier2: number; // 3-5km
  deliveryFeeTier3: number; // > 5km
  codThreshold: number | null;
}

// Defaults: 10% commission, ₹99 free delivery threshold, ₹10 (0-3km), ₹15 (3-5km), ₹20 (5+km).
const DEFAULT_CONFIG: ResolvedRevenueConfig = {
  commissionPct: 0.1,
  deliveryFeeFlat: 15,
  freeDeliveryThreshold: 99,
  deliveryFeeTier1: 10,
  deliveryFeeTier2: 15,
  deliveryFeeTier3: 20,
  codThreshold: null,
};

@Injectable()
export class RevenueConfigService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async create(adminUserId: string, dto: CreateRevenueConfigDto) {
    const [row] = await this.db
      .insert(revenueConfig)
      .values({
        scope: dto.scope,
        scopeRefId: dto.scope === 'global' ? null : dto.scopeRefId,
        commissionPct: dto.commissionPct,
        deliveryFeeFlat: dto.deliveryFeeFlat,
        freeDeliveryThreshold: dto.freeDeliveryThreshold ?? 99,
        deliveryFeeTier1: dto.deliveryFeeTier1 ?? 10,
        deliveryFeeTier2: dto.deliveryFeeTier2 ?? 15,
        deliveryFeeTier3: dto.deliveryFeeTier3 ?? 20,
        codThreshold: dto.codThreshold ?? null,
        notes: dto.notes ?? null,
        effectiveFrom: new Date(dto.effectiveFrom),
        createdBy: adminUserId,
      })
      .returning();
    return row;
  }

  async listAll() {
    const rows = await this.db.select().from(revenueConfig).orderBy(desc(revenueConfig.effectiveFrom));
    if (!rows.length) return [];
    const creatorIds = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => !!id))];
    const creators = creatorIds.length ? await this.db.select().from(users).where(inArray(users.id, creatorIds)) : [];
    const emailById = new Map(creators.map((u) => [u.id, u.email ?? u.phone ?? '']));
    return rows.map((r) => ({ ...r, createdByLabel: r.createdBy ? (emailById.get(r.createdBy) ?? '') : '' }));
  }

  // Resolution priority: vendor-scoped rule (most specific) > category-
  // scoped > global — within the winning scope, the rule with the latest
  // effectiveFrom that's still <= asOf wins. `asOf` defaults to now, but
  // callers always pass the order's own creation time so this resolves
  // identically no matter when it's re-queried later — the whole point of
  // snapshotting the result onto the order rather than resolving at read
  // time (TRD Section 3.5).
  async resolve(vendorId: string, categoryId: string | null, asOf: Date = new Date()): Promise<ResolvedRevenueConfig> {
    const rows = await this.db.select().from(revenueConfig).where(lte(revenueConfig.effectiveFrom, asOf));

    const latest = (candidates: typeof rows) =>
      candidates.length ? candidates.reduce((a, b) => (a.effectiveFrom > b.effectiveFrom ? a : b)) : null;

    const vendorRule = latest(rows.filter((r) => r.scope === 'vendor' && r.scopeRefId === vendorId));
    if (vendorRule) return this.toResolved(vendorRule);

    if (categoryId) {
      const categoryRule = latest(rows.filter((r) => r.scope === 'category' && r.scopeRefId === categoryId));
      if (categoryRule) return this.toResolved(categoryRule);
    }

    const globalRule = latest(rows.filter((r) => r.scope === 'global'));
    if (globalRule) return this.toResolved(globalRule);

    return DEFAULT_CONFIG;
  }

  private toResolved(row: typeof revenueConfig.$inferSelect): ResolvedRevenueConfig {
    return {
      commissionPct: row.commissionPct,
      deliveryFeeFlat: row.deliveryFeeFlat,
      freeDeliveryThreshold: row.freeDeliveryThreshold ?? 99,
      deliveryFeeTier1: row.deliveryFeeTier1 ?? 10,
      deliveryFeeTier2: row.deliveryFeeTier2 ?? 15,
      deliveryFeeTier3: row.deliveryFeeTier3 ?? 20,
      codThreshold: row.codThreshold,
    };
  }

  /**
   * Calculates delivery fee based on order subtotal and distance in km:
   * - Subtotal >= freeDeliveryThreshold (default ₹99): FREE (₹0).
   * - Distance <= 3 km: deliveryFeeTier1 (default ₹10).
   * - Distance 3-5 km: deliveryFeeTier2 (default ₹15).
   * - Distance > 5 km: deliveryFeeTier3 (default ₹20).
   */
  calculateDeliveryFee(
    config: ResolvedRevenueConfig,
    subtotal: number,
    distanceKm: number,
  ): number {
    if (subtotal >= (config.freeDeliveryThreshold ?? 99)) {
      return 0;
    }
    if (distanceKm <= 3) {
      return config.deliveryFeeTier1 ?? 10;
    }
    if (distanceKm <= 5) {
      return config.deliveryFeeTier2 ?? 15;
    }
    return config.deliveryFeeTier3 ?? 20;
  }
}
