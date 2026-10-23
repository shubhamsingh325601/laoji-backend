import { Inject, Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  allocationAttempts,
  categorySuggestions,
  deliveryPartners,
  foodOrders,
  groceryOrders,
  orderStatusHistory,
  productSuggestions,
  restaurants,
  settlements,
  vendorWithdrawals,
  vendors,
  type orderStatusEnum,
} from '../../../drizzle/schema';

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

// Abandoned checkouts (payment still pending/failed) are not real orders — keep them out of admin counts and alerts.
const CONFIRMED_PAYMENT = ['paid', 'pending_cod', 'collected', 'refund_pending', 'refunded'];

const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'failed', 'cancelled'];

// Per-status "how long is too long" thresholds (minutes), mirroring the
// laoji-admin mock's SLA table (src/api/mock/data.ts) and TRD Section 9.4's
// own worked example ("Accepted for 20+ minutes with no Preparing"). Not a
// new SLA concept — same thinking as ALLOCATION_SLA_SECONDS/
// DELIVERY_SLA_SECONDS (Phase 4/5), just for the manual vendor-progression
// stages those SLAs don't cover. handed_over/delivery_assigned/picked_up/
// out_for_delivery share one bucket (45m) the same way the admin UI's own
// status rail collapses them onto a single "picked up" stage.
const STUCK_SLA_MINUTES: Partial<Record<OrderStatus, number>> = {
  placed: 5,
  vendor_accepted: 20,
  preparing: 30,
  ready: 15,
  handed_over: 45,
  delivery_assigned: 45,
  picked_up: 45,
  out_for_delivery: 45,
};

export interface DashboardStats {
  ordersToday: { grocery: number; food: number };
  gmvToday: number;
  gmvDeltaPct: number;
  activeVendors: number;
  totalVendors: number;
  activePartners: number;
  totalPartners: number;
  pendingKyc: number;
  pendingSuggestions: number;
  pendingCategorySuggestions: number;
}

export interface DashboardSummary {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  failedOrders: number;
  cancellationRate: number;
  gmv: number;
  laojiEarnings: number;
  vendorEarnings: number;
  riderPayouts: number;
}

export interface RecentOrderRow {
  id: string;
  type: 'grocery' | 'food';
  status: OrderStatus;
  total: number;
  createdAt: Date;
  vendorName: string;
}

export interface AttentionItem {
  id: string;
  kind: 'stuck_order' | 'failed_allocation';
  title: string;
  detail: string;
  minutesWaiting: number;
  severity: 'warning' | 'critical';
  href: string;
}

export interface ReportSeriesPoint {
  date: string;
  grocery: number;
  food: number;
  revenue: number;
}

export interface VendorPerformanceRow {
  vendorId: string;
  vendorName: string;
  orders: number;
  gmv: number;
  acceptanceRate: number;
  avgPrepMinutes: number;
  rank?: number;
}

export interface CancellationRow {
  cause: 'customer' | 'vendor' | 'no_fulfillment';
  count: number;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function code(id: string) {
  return id.slice(0, 8).toUpperCase();
}

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  // ------------------------------------------------------------- stats

  async getStats(): Promise<DashboardStats> {
    const todayStart = startOfDay(new Date());
    const lastWeekStart = new Date(todayStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(todayStart);

    // Overall GMV and completed orders must ONLY count orders with status = 'delivered'.
    // Non-delivered orders (cancelled, failed, pending, placed) must not be counted as completed GMV.
    // Everything is counted in the database; only the totals come back.
    const windows = (t: typeof groceryOrders | typeof foodOrders) =>
      this.db
        .select({
          deliveredToday: sql<number>`count(*) filter (where ${t.status} = 'delivered' and ${t.createdAt} >= ${todayStart})::int`,
          gmvToday: sql<number>`coalesce(sum(${t.total}) filter (where ${t.status} = 'delivered' and ${t.createdAt} >= ${todayStart}), 0)::float8`,
          gmvLastWeek: sql<number>`coalesce(sum(${t.total}) filter (where ${t.status} = 'delivered' and ${t.createdAt} >= ${lastWeekStart} and ${t.createdAt} < ${lastWeekEnd}), 0)::float8`,
        })
        .from(t)
        .where(and(gte(t.createdAt, lastWeekStart), inArray(t.paymentStatus, CONFIRMED_PAYMENT)));

    const [[grocery], [food], [vendorAgg], [partnerAgg], [productSuggestionAgg], [categorySuggestionAgg]] =
      await Promise.all([
        windows(groceryOrders),
        windows(foodOrders),
        this.db
          .select({
            total: sql<number>`count(*)::int`,
            open: sql<number>`count(*) filter (where ${vendors.isOpen})::int`,
            pendingKyc: sql<number>`count(*) filter (where ${vendors.kycStatus} = 'pending')::int`,
          })
          .from(vendors),
        this.db
          .select({
            verified: sql<number>`count(*) filter (where ${deliveryPartners.kycStatus} = 'verified')::int`,
            verifiedOnline: sql<number>`count(*) filter (where ${deliveryPartners.kycStatus} = 'verified' and ${deliveryPartners.isOnline})::int`,
            pendingKyc: sql<number>`count(*) filter (where ${deliveryPartners.kycStatus} = 'pending')::int`,
          })
          .from(deliveryPartners),
        this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(productSuggestions)
          .where(eq(productSuggestions.status, 'pending')),
        this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(categorySuggestions)
          .where(eq(categorySuggestions.status, 'pending')),
      ]);

    const gmvToday = roundMoney(grocery.gmvToday) + roundMoney(food.gmvToday);
    const gmvLastWeek = roundMoney(grocery.gmvLastWeek) + roundMoney(food.gmvLastWeek);
    const gmvDeltaPct = gmvLastWeek > 0 ? Math.round(((gmvToday - gmvLastWeek) / gmvLastWeek) * 1000) / 10 : 0;

    return {
      ordersToday: {
        grocery: grocery.deliveredToday,
        food: food.deliveredToday,
      },
      gmvToday: roundMoney(gmvToday),
      gmvDeltaPct,
      activeVendors: vendorAgg.open,
      totalVendors: vendorAgg.total,
      activePartners: partnerAgg.verifiedOnline,
      totalPartners: partnerAgg.verified,
      pendingKyc: vendorAgg.pendingKyc + partnerAgg.pendingKyc,
      pendingSuggestions: productSuggestionAgg.n,
      pendingCategorySuggestions: categorySuggestionAgg.n,
    };
  }

  // ------------------------------------------------------------ summary

  /**
   * Lifetime totals behind the "All-Time Performance & Earnings" cards on the
   * dashboard and reports pages — counted in the database instead of the
   * browser adding up every order. Orders are the real (payment-confirmed)
   * ones only. Earnings come from settlements once any exist, otherwise they
   * are estimated from delivered orders — the same rule the pages used.
   */
  async getSummary(): Promise<DashboardSummary> {
    const perTable = (t: typeof groceryOrders | typeof foodOrders) =>
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          delivered: sql<number>`count(*) filter (where ${t.status} = 'delivered')::int`,
          cancelled: sql<number>`count(*) filter (where ${t.status} = 'cancelled')::int`,
          failed: sql<number>`count(*) filter (where ${t.status} = 'failed')::int`,
          gmv: sql<number>`coalesce(sum(${t.total}) filter (where ${t.status} = 'delivered'), 0)::float8`,
          commission: sql<number>`coalesce(sum(${t.platformCommission}) filter (where ${t.status} = 'delivered'), 0)::float8`,
          vendorNet: sql<number>`coalesce(sum(greatest(0, ${t.subtotal} - ${t.platformCommission})) filter (where ${t.status} = 'delivered'), 0)::float8`,
          deliveryFees: sql<number>`coalesce(sum(${t.deliveryFee}) filter (where ${t.status} = 'delivered'), 0)::float8`,
        })
        .from(t)
        .where(inArray(t.paymentStatus, CONFIRMED_PAYMENT));

    const [[grocery], [food], [settled]] = await Promise.all([
      perTable(groceryOrders),
      perTable(foodOrders),
      this.db
        .select({
          rows: sql<number>`count(*)::int`,
          platformShare: sql<number>`coalesce(sum(${settlements.platformShare}), 0)::float8`,
          vendorPayout: sql<number>`coalesce(sum(${settlements.vendorPayout}), 0)::float8`,
          deliveryPayout: sql<number>`coalesce(sum(${settlements.deliveryPayout}), 0)::float8`,
        })
        .from(settlements),
    ]);

    const totalOrders = grocery.total + food.total;
    const cancelledOrders = grocery.cancelled + food.cancelled;
    const failedOrders = grocery.failed + food.failed;
    const unfulfilled = cancelledOrders + failedOrders;
    const hasSettlements = settled.rows > 0;

    return {
      totalOrders,
      deliveredOrders: grocery.delivered + food.delivered,
      cancelledOrders,
      failedOrders,
      cancellationRate: totalOrders > 0 ? Math.round((unfulfilled / totalOrders) * 1000) / 10 : 0,
      gmv: roundMoney(grocery.gmv + food.gmv),
      laojiEarnings: roundMoney(hasSettlements ? settled.platformShare : grocery.commission + food.commission),
      vendorEarnings: roundMoney(hasSettlements ? settled.vendorPayout : grocery.vendorNet + food.vendorNet),
      riderPayouts: roundMoney(hasSettlements ? settled.deliveryPayout : grocery.deliveryFees + food.deliveryFees),
    };
  }

  /** The newest few real orders, with the vendor / restaurant name already attached. */
  async getRecentOrders(limit = 7): Promise<RecentOrderRow[]> {
    const take = Math.min(Math.max(Math.trunc(limit) || 7, 1), 50);
    const [grocery, food] = await Promise.all([
      this.db
        .select({
          id: groceryOrders.id,
          status: groceryOrders.status,
          total: groceryOrders.total,
          createdAt: groceryOrders.createdAt,
          vendorName: vendors.businessName,
        })
        .from(groceryOrders)
        .leftJoin(vendors, eq(vendors.id, groceryOrders.vendorId))
        .where(inArray(groceryOrders.paymentStatus, CONFIRMED_PAYMENT))
        .orderBy(desc(groceryOrders.createdAt))
        .limit(take),
      this.db
        .select({
          id: foodOrders.id,
          status: foodOrders.status,
          total: foodOrders.total,
          createdAt: foodOrders.createdAt,
          vendorName: restaurants.name,
        })
        .from(foodOrders)
        .leftJoin(restaurants, eq(restaurants.id, foodOrders.restaurantId))
        .where(inArray(foodOrders.paymentStatus, CONFIRMED_PAYMENT))
        .orderBy(desc(foodOrders.createdAt))
        .limit(take),
    ]);

    return [
      ...grocery.map((o) => ({ ...o, type: 'grocery' as const, vendorName: o.vendorName ?? 'Unassigned' })),
      ...food.map((o) => ({ ...o, type: 'food' as const, vendorName: o.vendorName ?? 'Unknown restaurant' })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);
  }

  // ------------------------------------------------------ vendor summary

  /**
   * Per-vendor numbers for the admin vendor profile, over an optional
   * [from, to] range (inclusive calendar days, IST-agnostic: bounds are
   * taken as given by the client). Order/earning figures count delivered
   * orders only; settlements are written at delivery, so vendorPayout is
   * what the vendor earned and platformShare is what Laoji earned.
   */
  async getVendorSummary(vendorId: string, fromRaw?: string, toRaw?: string) {
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
      throw new BadRequestException('Invalid from/to date');
    }

    const [restaurant] = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.vendorId, vendorId))
      .limit(1);

    const range = (col: PgColumn) => [
      ...(from ? [gte(col, from)] : []),
      ...(to ? [lt(col, to)] : []),
    ];

    const [grocery, food] = await Promise.all([
      this.db
        .select()
        .from(groceryOrders)
        .where(and(eq(groceryOrders.vendorId, vendorId), inArray(groceryOrders.paymentStatus, CONFIRMED_PAYMENT), ...range(groceryOrders.createdAt))),
      restaurant
        ? this.db
            .select()
            .from(foodOrders)
            .where(and(eq(foodOrders.restaurantId, restaurant.id), inArray(foodOrders.paymentStatus, CONFIRMED_PAYMENT), ...range(foodOrders.createdAt)))
        : Promise.resolve([] as (typeof foodOrders.$inferSelect)[]),
    ]);

    const delivered = [...grocery, ...food].filter((o) => o.status === 'delivered');
    const groceryIds = grocery.filter((o) => o.status === 'delivered').map((o) => o.id);
    const foodIds = food.filter((o) => o.status === 'delivered').map((o) => o.id);

    const rows = [
      ...(groceryIds.length
        ? await this.db.select().from(settlements).where(inArray(settlements.groceryOrderId, groceryIds))
        : []),
      ...(foodIds.length
        ? await this.db.select().from(settlements).where(inArray(settlements.foodOrderId, foodIds))
        : []),
    ];

    // Acceptance + prep time over the same range (same signals as
    // getVendorPerformance: grocery from allocation_attempts, food from status history).
    const allIds = [...grocery, ...food].map((o) => o.id);
    const [attempts, history] = await Promise.all([
      this.db
        .select()
        .from(allocationAttempts)
        .where(and(eq(allocationAttempts.vendorId, vendorId), ...range(allocationAttempts.createdAt))),
      allIds.length
        ? this.db
            .select()
            .from(orderStatusHistory)
            .where(or(inArray(orderStatusHistory.groceryOrderId, allIds), inArray(orderStatusHistory.foodOrderId, allIds)))
        : Promise.resolve([] as (typeof orderStatusHistory.$inferSelect)[]),
    ]);
    const acceptedAt = new Map<string, Date>();
    const readyAt = new Map<string, Date>();
    for (const h of history) {
      const id = h.groceryOrderId ?? h.foodOrderId;
      if (!id) continue;
      if (h.status === 'vendor_accepted') acceptedAt.set(id, h.changedAt);
      if (h.status === 'ready') readyAt.set(id, h.changedAt);
    }
    let accepted = attempts.filter((x) => x.outcome === 'accepted').length;
    let rejected = attempts.filter((x) => x.outcome === 'rejected' || x.outcome === 'timeout').length;
    for (const o of food) {
      if (acceptedAt.has(o.id)) accepted += 1;
      else if (o.status === 'failed') rejected += 1;
    }
    const prep: number[] = [];
    for (const id of allIds) {
      const st = acceptedAt.get(id);
      const en = readyAt.get(id);
      if (st && en && en > st) prep.push((en.getTime() - st.getTime()) / 60000);
    }

    const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

    // Lifetime balance calculations for withdrawal
    const totalPayoutSql = sql<number>`coalesce(sum(${settlements.vendorPayout}), 0)`;
    const [[[lifetimeGrocery], [lifetimeFood]], withdrawalRows] = await Promise.all([
      Promise.all([
        this.db
          .select({ total: totalPayoutSql })
          .from(settlements)
          .innerJoin(groceryOrders, eq(settlements.groceryOrderId, groceryOrders.id))
          .where(eq(groceryOrders.vendorId, vendorId)),
        this.db
          .select({ total: totalPayoutSql })
          .from(settlements)
          .innerJoin(foodOrders, eq(settlements.foodOrderId, foodOrders.id))
          .innerJoin(restaurants, eq(foodOrders.restaurantId, restaurants.id))
          .where(eq(restaurants.vendorId, vendorId)),
      ]),
      this.db
        .select({
          status: vendorWithdrawals.status,
          total: sql<number>`coalesce(sum(${vendorWithdrawals.amount}), 0)`,
        })
        .from(vendorWithdrawals)
        .where(eq(vendorWithdrawals.vendorId, vendorId))
        .groupBy(vendorWithdrawals.status),
    ]);

    const lifetimeEarned = Number(lifetimeGrocery?.total ?? 0) + Number(lifetimeFood?.total ?? 0);
    const sumForStatus = (status: string) => Number(withdrawalRows.find((r) => r.status === status)?.total ?? 0);
    const totalWithdrawn = sumForStatus('approved');
    const pendingWithdrawal = sumForStatus('pending');
    const remainingBalance = Math.max(0, Math.round((lifetimeEarned - totalWithdrawn - pendingWithdrawal) * 100) / 100);

    return {
      acceptanceRate: accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 1000) / 10 : null,
      avgPrepMinutes: prep.length ? Math.round((prep.reduce((x, y) => x + y, 0) / prep.length) * 10) / 10 : null,
      totalOrders: delivered.length,
      deliveredOrders: delivered.length,
      cancelledOrders: [...grocery, ...food].filter((o) => o.status === 'cancelled' || o.status === 'failed').length,
      grossSales: sum(delivered.map((o) => o.total)),
      vendorEarnings: sum(rows.map((r) => r.vendorPayout)),
      platformEarnings: sum(rows.map((r) => r.platformShare)),
      totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
      pendingWithdrawal: Math.round(pendingWithdrawal * 100) / 100,
      remainingBalance,
      availableBalance: remainingBalance,
    };
  }

  // ---------------------------------------------------------- attention

  async getAttention(): Promise<AttentionItem[]> {
    const nonTerminal = Object.keys(STUCK_SLA_MINUTES) as OrderStatus[];

    const [groceryOpen, foodOpen] = await Promise.all([
      this.db
        .select({
          id: groceryOrders.id,
          status: groceryOrders.status,
          total: groceryOrders.total,
          vendorId: groceryOrders.vendorId,
        })
        .from(groceryOrders)
        .where(and(inArray(groceryOrders.status, nonTerminal), inArray(groceryOrders.paymentStatus, CONFIRMED_PAYMENT))),
      this.db
        .select({
          id: foodOrders.id,
          status: foodOrders.status,
          total: foodOrders.total,
          restaurantId: foodOrders.restaurantId,
        })
        .from(foodOrders)
        .where(and(inArray(foodOrders.status, nonTerminal), inArray(foodOrders.paymentStatus, CONFIRMED_PAYMENT))),
    ]);

    const groceryIds = groceryOpen.map((o) => o.id);
    const foodIds = foodOpen.map((o) => o.id);

    const vendorNames = await this.vendorNameMap(groceryOpen.map((o) => o.vendorId));
    const restaurantNames = await this.restaurantNameMap(foodOpen.map((o) => o.restaurantId));

    const latestChangeByOrder = await this.latestStatusChangeMap(groceryIds, foodIds);

    const now = Date.now();
    const items: AttentionItem[] = [];

    for (const o of groceryOpen) {
      this.pushStuckIfDue(items, o.id, o.status, latestChangeByOrder.get(o.id), now, {
        name: vendorNames.get(o.vendorId ?? '') ?? 'Unassigned vendor',
        total: o.total,
      });
    }
    for (const o of foodOpen) {
      this.pushStuckIfDue(items, o.id, o.status, latestChangeByOrder.get(o.id), now, {
        name: restaurantNames.get(o.restaurantId) ?? 'Unknown restaurant',
        total: o.total,
      });
    }

    // Recent no-fulfillment failures (grocery allocation exhausted, or
    // delivery-partner matching exhausted post-handed_over — both write
    // status='failed' with actor_role='system', see order.service.ts /
    // allocation.service.ts / delivery.service.ts). Last 24h only, so this
    // panel doesn't fill up with old, already-handled failures.
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const [recentFailedGrocery, recentFailedFood] = await Promise.all([
      this.db
        .select({ id: groceryOrders.id, total: groceryOrders.total, vendorId: groceryOrders.vendorId })
        .from(groceryOrders)
        .where(and(eq(groceryOrders.status, 'failed'), gte(groceryOrders.createdAt, since))),
      this.db
        .select({ id: foodOrders.id, total: foodOrders.total, restaurantId: foodOrders.restaurantId })
        .from(foodOrders)
        .where(and(eq(foodOrders.status, 'failed'), gte(foodOrders.createdAt, since))),
    ]);
    const failedChangeByOrder = await this.latestStatusChangeMap(
      recentFailedGrocery.map((o) => o.id),
      recentFailedFood.map((o) => o.id),
    );
    const failedVendorNames = await this.vendorNameMap(recentFailedGrocery.map((o) => o.vendorId));

    for (const o of recentFailedGrocery) {
      const changedAt = failedChangeByOrder.get(o.id);
      if (!changedAt) continue;
      const minutesWaiting = Math.round((now - changedAt.getTime()) / 60000);
      items.push({
        id: `att_${o.id}`,
        kind: 'failed_allocation',
        title: `${code(o.id)} — no vendor/delivery-partner allocated`,
        detail: `${failedVendorNames.get(o.vendorId ?? '') ?? 'Unassigned vendor'} · ₹${o.total.toLocaleString('en-IN')}`,
        minutesWaiting,
        severity: 'critical',
        href: `/orders/${o.id}`,
      });
    }
    // Food "failed" is a direct vendor rejection, not a fulfillment gap —
    // deliberately not surfaced here (that's the vendor cause bucket in
    // getCancellations(), not a live ops alert).
    void recentFailedFood;

    return items.sort((a, b) => b.minutesWaiting - a.minutesWaiting).slice(0, 20);
  }

  private pushStuckIfDue(
    items: AttentionItem[],
    id: string,
    status: OrderStatus,
    changedAt: Date | undefined,
    now: number,
    place: { name: string; total: number },
  ) {
    const thresholdMinutes = STUCK_SLA_MINUTES[status];
    if (!thresholdMinutes || !changedAt) return;
    const minutesWaiting = Math.round((now - changedAt.getTime()) / 60000);
    if (minutesWaiting <= thresholdMinutes) return;
    items.push({
      id: `att_${id}`,
      kind: 'stuck_order',
      title: `${code(id)} — stuck at ${status.replace(/_/g, ' ')}`,
      detail: `${place.name} · no movement for ${minutesWaiting} min (SLA ${thresholdMinutes} min)`,
      minutesWaiting,
      severity: minutesWaiting > thresholdMinutes * 2 ? 'critical' : 'warning',
      href: `/orders/${id}`,
    });
  }

  // When each order's status last changed. The latest is worked out per order
  // in the database, so a long order timeline isn't pulled over just to read
  // its final row.
  private async latestStatusChangeMap(groceryIds: string[], foodIds: string[]) {
    const map = new Map<string, Date>();
    const latest = sql`max(${orderStatusHistory.changedAt})`.mapWith(orderStatusHistory.changedAt);

    const [groceryRows, foodRows] = await Promise.all([
      groceryIds.length
        ? this.db
            .select({ orderId: orderStatusHistory.groceryOrderId, changedAt: latest })
            .from(orderStatusHistory)
            .where(inArray(orderStatusHistory.groceryOrderId, groceryIds))
            .groupBy(orderStatusHistory.groceryOrderId)
        : [],
      foodIds.length
        ? this.db
            .select({ orderId: orderStatusHistory.foodOrderId, changedAt: latest })
            .from(orderStatusHistory)
            .where(inArray(orderStatusHistory.foodOrderId, foodIds))
            .groupBy(orderStatusHistory.foodOrderId)
        : [],
    ]);

    for (const r of [...groceryRows, ...foodRows]) {
      if (r.orderId) map.set(r.orderId, r.changedAt);
    }
    return map;
  }

  private async vendorNameMap(vendorIds: (string | null)[]) {
    const ids = [...new Set(vendorIds.filter((v): v is string => !!v))];
    if (ids.length === 0) return new Map<string, string>();
    const rows = await this.db
      .select({ id: vendors.id, businessName: vendors.businessName })
      .from(vendors)
      .where(inArray(vendors.id, ids));
    return new Map(rows.map((r) => [r.id, r.businessName]));
  }

  private async restaurantNameMap(restaurantIds: string[]) {
    const ids = [...new Set(restaurantIds)];
    if (ids.length === 0) return new Map<string, string>();
    const rows = await this.db
      .select({ id: restaurants.id, name: restaurants.name })
      .from(restaurants)
      .where(inArray(restaurants.id, ids));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // ------------------------------------------------------------ reports

  async getSeries(days: number): Promise<ReportSeriesPoint[]> {
    const start = startOfDay(new Date());
    start.setDate(start.getDate() - (days - 1));

    const [grocery, food] = await Promise.all([
      this.db
        .select({
          createdAt: groceryOrders.createdAt,
          status: groceryOrders.status,
          platformCommission: groceryOrders.platformCommission,
          total: groceryOrders.total,
        })
        .from(groceryOrders)
        .where(gte(groceryOrders.createdAt, start)),
      this.db
        .select({
          createdAt: foodOrders.createdAt,
          status: foodOrders.status,
          platformCommission: foodOrders.platformCommission,
          total: foodOrders.total,
        })
        .from(foodOrders)
        .where(gte(foodOrders.createdAt, start)),
    ]);

    const buckets = new Map<string, { grocery: number; food: number; revenue: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets.set(dayKey(d), { grocery: 0, food: 0, revenue: 0 });
    }

    for (const o of grocery) {
      const b = buckets.get(dayKey(o.createdAt));
      if (!b) continue;
      // In reports, completed orders count and daily GMV / revenue only count delivered orders
      if (o.status === 'delivered') {
        b.grocery += 1;
        b.revenue += o.total;
      }
    }
    for (const o of food) {
      const b = buckets.get(dayKey(o.createdAt));
      if (!b) continue;
      if (o.status === 'delivered') {
        b.food += 1;
        b.revenue += o.total;
      }
    }

    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }

  // Vendor leaderboard for one calendar month. The work is done in the
  // database in one query: only orders from roughly this month are looked at
  // (an order is never delivered a month after it was placed), and only one
  // row per ranked vendor comes back.
  //   - orders / GMV: orders delivered in the month. The delivery time is the
  //     status-history 'delivered' row, falling back to when it was placed.
  //   - acceptance: food orders placed in the month (accepted if the vendor
  //     accepted it, rejected if it failed unaccepted) plus grocery
  //     allocation attempts made in the month (accepted vs rejected/timeout).
  //   - prep time: vendor_accepted -> ready, on those delivered orders.
  async getVendorPerformance(monthStr?: string): Promise<VendorPerformanceRow[]> {
    const now = new Date();
    let startOfMonth: Date;
    let endOfMonth: Date;
    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
      const [year, month] = monthStr.split('-').map(Number);
      startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const lookback = new Date(startOfMonth.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.db.execute(sql`
      with g as (
        select o.id, o.vendor_id, o.status, o.total, o.created_at
        from grocery_orders o
        where o.vendor_id is not null and o.created_at >= ${lookback} and o.created_at <= ${endOfMonth}
      ),
      f as (
        select o.id, r.vendor_id, o.status, o.total, o.created_at
        from food_orders o
        join restaurants r on r.id = o.restaurant_id
        where o.created_at >= ${lookback} and o.created_at <= ${endOfMonth}
      ),
      ord as (
        select id, 'grocery'::text as kind, vendor_id, status, total, created_at from g
        union all
        select id, 'food'::text as kind, vendor_id, status, total, created_at from f
      ),
      hist as (
        select coalesce(h.grocery_order_id, h.food_order_id) as order_id,
               max(h.changed_at) filter (where h.status = 'vendor_accepted') as accepted_at,
               max(h.changed_at) filter (where h.status = 'ready') as ready_at,
               max(h.changed_at) filter (where h.status = 'delivered') as delivered_at
        from order_status_history h
        where h.status in ('vendor_accepted', 'ready', 'delivered')
          and (h.grocery_order_id in (select id from g) or h.food_order_id in (select id from f))
        group by 1
      ),
      joined as (
        select ord.*, hist.accepted_at, hist.ready_at,
               coalesce(hist.delivered_at, ord.created_at) as delivered_effective
        from ord
        left join hist on hist.order_id = ord.id
      ),
      delivered as (
        select vendor_id,
               count(*)::int as orders,
               coalesce(sum(total), 0)::float8 as gmv,
               (avg(extract(epoch from (ready_at - accepted_at)) / 60.0)
                  filter (where accepted_at is not null and ready_at is not null and ready_at > accepted_at))::float8 as avg_prep
        from joined
        where status = 'delivered' and delivered_effective >= ${startOfMonth} and delivered_effective <= ${endOfMonth}
        group by vendor_id
      ),
      food_decisions as (
        select vendor_id,
               count(*) filter (where accepted_at is not null)::int as accepted,
               count(*) filter (where accepted_at is null and status = 'failed')::int as rejected
        from joined
        where kind = 'food' and created_at >= ${startOfMonth} and created_at <= ${endOfMonth}
        group by vendor_id
      ),
      grocery_decisions as (
        select vendor_id,
               count(*) filter (where outcome = 'accepted')::int as accepted,
               count(*) filter (where outcome in ('rejected', 'timeout'))::int as rejected
        from allocation_attempts
        where created_at >= ${startOfMonth} and created_at <= ${endOfMonth}
        group by vendor_id
      )
      select v.id as vendor_id,
             v.business_name as vendor_name,
             d.orders,
             d.gmv,
             d.avg_prep,
             coalesce(fd.accepted, 0) + coalesce(gd.accepted, 0) as accepted,
             coalesce(fd.rejected, 0) + coalesce(gd.rejected, 0) as rejected
      from delivered d
      join vendors v on v.id = d.vendor_id
      left join food_decisions fd on fd.vendor_id = d.vendor_id
      left join grocery_decisions gd on gd.vendor_id = d.vendor_id
    `);

    const rows = (result.rows as Record<string, unknown>[])
      .map((r) => {
        const accepted = Number(r.accepted);
        const decided = accepted + Number(r.rejected);
        const avgPrep = r.avg_prep === null || r.avg_prep === undefined ? null : Number(r.avg_prep);
        return {
          vendorId: String(r.vendor_id),
          vendorName: (r.vendor_name as string | null) ?? 'Unknown vendor',
          orders: Number(r.orders),
          gmv: Math.round(Number(r.gmv) * 100) / 100,
          acceptanceRate: decided > 0 ? Math.round((accepted / decided) * 1000) / 10 : 0,
          avgPrepMinutes: avgPrep !== null ? Math.round(avgPrep * 10) / 10 : 0,
        };
      })
      .filter((r) => r.orders > 0)
      .sort((a, b) => b.orders - a.orders || b.acceptanceRate - a.acceptanceRate)
      .map((r, index) => ({ ...r, rank: index + 1 }));

    return rows;
  }

  async getCancellations(): Promise<CancellationRow[]> {
    const rows = await this.db
      .select({
        status: orderStatusHistory.status,
        actorRole: orderStatusHistory.actorRole,
        n: sql<number>`count(*)::int`,
      })
      .from(orderStatusHistory)
      .where(inArray(orderStatusHistory.status, ['failed', 'cancelled']))
      .groupBy(orderStatusHistory.status, orderStatusHistory.actorRole);

    let customer = 0;
    let vendor = 0;
    let noFulfillment = 0;

    for (const r of rows) {
      // No customer self-service cancel endpoint exists yet (see
      // order.service.ts's cancelOrder comment) — every 'cancelled' row is
      // admin-initiated today, and in practice that's an admin acting on a
      // customer's request, so it's bucketed as the 'customer' cause here.
      // Flagged rather than silently assumed: if a real customer-cancel
      // endpoint is added later, it should get its own actor_role branch.
      if (r.status === 'cancelled' && r.actorRole === 'admin') customer += r.n;
      else if (r.status === 'failed' && r.actorRole === 'vendor') vendor += r.n;
      else if (r.status === 'failed' && r.actorRole === 'system') noFulfillment += r.n;
    }

    return [
      { cause: 'customer', count: customer },
      { cause: 'vendor', count: vendor },
      { cause: 'no_fulfillment', count: noFulfillment },
    ];
  }
}

function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
