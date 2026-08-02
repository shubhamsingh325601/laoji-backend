import { Inject, Injectable } from '@nestjs/common';
import { desc, inArray, lte } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { revenueConfig, users } from '../../../drizzle/schema';
import type { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';

export interface ResolvedRevenueConfig {
  commissionPct: number;
  deliveryFeeFlat: number;
  codThreshold: number | null;
}

// Falls back to the pre-Phase-8 hardcoded constants (10% commission, ₹30
// flat delivery fee) whenever an admin hasn't configured anything yet —
// keeps checkout working exactly as before with zero rules on record,
// rather than throwing on every order.
const DEFAULT_CONFIG: ResolvedRevenueConfig = { commissionPct: 0.1, deliveryFeeFlat: 30, codThreshold: null };

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
    return { commissionPct: row.commissionPct, deliveryFeeFlat: row.deliveryFeeFlat, codThreshold: row.codThreshold };
  }
}
