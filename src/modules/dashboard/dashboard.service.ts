import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lt, or, type SQL } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  allocationAttempts,
  deliveryPartners,
  foodOrders,
  groceryOrders,
  orderStatusHistory,
  productSuggestions,
  restaurants,
  vendors,
  type orderStatusEnum,
} from '../../../drizzle/schema';

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

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

    const [groceryToday, foodToday, groceryLastWeek, foodLastWeek] = await Promise.all([
      this.db.select().from(groceryOrders).where(gte(groceryOrders.createdAt, todayStart)),
      this.db.select().from(foodOrders).where(gte(foodOrders.createdAt, todayStart)),
      this.db
        .select()
        .from(groceryOrders)
        .where(and(gte(groceryOrders.createdAt, lastWeekStart), lt(groceryOrders.createdAt, lastWeekEnd))),
      this.db
        .select()
        .from(foodOrders)
        .where(and(gte(foodOrders.createdAt, lastWeekStart), lt(foodOrders.createdAt, lastWeekEnd))),
    ]);

    // GMV = gross value of orders placed today, regardless of outcome — the
    // same "orders today" population as ordersToday above, not just
    // completed ones. Revenue (platform's own earnings) is a different,
    // narrower number — see getSeries() below, which uses delivered-only
    // commission instead.
    const gmvToday = sumTotal(groceryToday) + sumTotal(foodToday);
    const gmvLastWeek = sumTotal(groceryLastWeek) + sumTotal(foodLastWeek);
    const gmvDeltaPct = gmvLastWeek > 0 ? Math.round(((gmvToday - gmvLastWeek) / gmvLastWeek) * 1000) / 10 : 0;

    const [allVendors, allPartners, pendingSuggestionsRows] = await Promise.all([
      this.db.select().from(vendors),
      this.db.select().from(deliveryPartners),
      this.db.select().from(productSuggestions).where(eq(productSuggestions.status, 'pending')),
    ]);

    const verifiedPartners = allPartners.filter((p) => p.kycStatus === 'verified');

    return {
      ordersToday: { grocery: groceryToday.length, food: foodToday.length },
      gmvToday,
      gmvDeltaPct,
      activeVendors: allVendors.filter((v) => v.isOpen).length,
      totalVendors: allVendors.length,
      activePartners: verifiedPartners.filter((p) => p.isOnline).length,
      totalPartners: verifiedPartners.length,
      pendingKyc:
        allVendors.filter((v) => v.kycStatus === 'pending').length +
        allPartners.filter((p) => p.kycStatus === 'pending').length,
      pendingSuggestions: pendingSuggestionsRows.length,
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
        .where(inArray(groceryOrders.status, nonTerminal)),
      this.db
        .select({
          id: foodOrders.id,
          status: foodOrders.status,
          total: foodOrders.total,
          restaurantId: foodOrders.restaurantId,
        })
        .from(foodOrders)
        .where(inArray(foodOrders.status, nonTerminal)),
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

  private async latestStatusChangeMap(groceryIds: string[], foodIds: string[]) {
    const map = new Map<string, Date>();
    if (groceryIds.length === 0 && foodIds.length === 0) return map;

    const conditions: SQL[] = [];
    if (groceryIds.length) conditions.push(inArray(orderStatusHistory.groceryOrderId, groceryIds));
    if (foodIds.length) conditions.push(inArray(orderStatusHistory.foodOrderId, foodIds));

    const rows = await this.db
      .select({
        groceryOrderId: orderStatusHistory.groceryOrderId,
        foodOrderId: orderStatusHistory.foodOrderId,
        changedAt: orderStatusHistory.changedAt,
      })
      .from(orderStatusHistory)
      .where(or(...conditions));

    for (const r of rows) {
      const orderId = r.groceryOrderId ?? r.foodOrderId!;
      const existing = map.get(orderId);
      if (!existing || r.changedAt > existing) map.set(orderId, r.changedAt);
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
        })
        .from(groceryOrders)
        .where(gte(groceryOrders.createdAt, start)),
      this.db
        .select({
          createdAt: foodOrders.createdAt,
          status: foodOrders.status,
          platformCommission: foodOrders.platformCommission,
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
      b.grocery += 1;
      // Revenue counts platform_commission only for orders that actually
      // completed (delivered) — order *volume* above counts everything
      // placed, but "revenue" shouldn't credit money that was never
      // actually earned on a failed/cancelled order.
      if (o.status === 'delivered') b.revenue += o.platformCommission;
    }
    for (const o of food) {
      const b = buckets.get(dayKey(o.createdAt));
      if (!b) continue;
      b.food += 1;
      if (o.status === 'delivered') b.revenue += o.platformCommission;
    }

    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }

  async getVendorPerformance(): Promise<VendorPerformanceRow[]> {
    const [allVendors, allRestaurants, allGrocery, allFood, attempts, history] = await Promise.all([
      this.db.select().from(vendors),
      this.db.select().from(restaurants),
      this.db.select().from(groceryOrders),
      this.db.select().from(foodOrders),
      this.db.select().from(allocationAttempts),
      this.db.select().from(orderStatusHistory),
    ]);

    const restaurantVendorId = new Map(allRestaurants.map((r) => [r.id, r.vendorId]));

    type Agg = { orders: number; gmv: number; accepted: number; rejected: number; prepMinutes: number[] };
    const agg = new Map<string, Agg>();
    const ensure = (vendorId: string): Agg => {
      let a = agg.get(vendorId);
      if (!a) {
        a = { orders: 0, gmv: 0, accepted: 0, rejected: 0, prepMinutes: [] };
        agg.set(vendorId, a);
      }
      return a;
    };

    // Prep time: gap between vendor_accepted and ready per order, from
    // order_status_history's own timestamps (TRD Section 9.4's vendor
    // performance visibility, no new tracking needed).
    const acceptedAt = new Map<string, Date>();
    const readyAt = new Map<string, Date>();
    for (const h of history) {
      const orderId = h.groceryOrderId ?? h.foodOrderId;
      if (!orderId) continue;
      if (h.status === 'vendor_accepted') acceptedAt.set(orderId, h.changedAt);
      if (h.status === 'ready') readyAt.set(orderId, h.changedAt);
    }

    for (const o of allGrocery) {
      if (!o.vendorId) continue;
      const a = ensure(o.vendorId);
      a.orders += 1;
      a.gmv += o.total;
      const start = acceptedAt.get(o.id);
      const end = readyAt.get(o.id);
      if (start && end && end > start) a.prepMinutes.push((end.getTime() - start.getTime()) / 60000);
    }
    for (const o of allFood) {
      const vendorId = restaurantVendorId.get(o.restaurantId);
      if (!vendorId) continue;
      const a = ensure(vendorId);
      a.orders += 1;
      a.gmv += o.total;
      const start = acceptedAt.get(o.id);
      const end = readyAt.get(o.id);
      if (start && end && end > start) a.prepMinutes.push((end.getTime() - start.getTime()) / 60000);
      // Food has no allocation_attempts row (no allocation waterfall) — its
      // accept/reject signal is the order's own status history instead.
      if (acceptedAt.has(o.id)) ensure(vendorId).accepted += 1;
      else if (o.status === 'failed') ensure(vendorId).rejected += 1;
    }

    // Grocery acceptance comes from allocation_attempts (captures every
    // vendor offered the order, including ones who rejected/timed out
    // before a different vendor accepted) — a more precise signal than
    // order_status_history alone, which only ever sees the vendor who
    // eventually accepted.
    for (const at of attempts) {
      const a = ensure(at.vendorId);
      if (at.outcome === 'accepted') a.accepted += 1;
      else if (at.outcome === 'rejected' || at.outcome === 'timeout') a.rejected += 1;
    }

    const rows: VendorPerformanceRow[] = [...agg.entries()]
      .map(([vendorId, a]) => {
        const vendor = allVendors.find((v) => v.id === vendorId);
        const decided = a.accepted + a.rejected;
        return {
          vendorId,
          vendorName: vendor?.businessName ?? 'Unknown vendor',
          orders: a.orders,
          gmv: Math.round(a.gmv * 100) / 100,
          acceptanceRate: decided > 0 ? Math.round((a.accepted / decided) * 1000) / 10 : 0,
          avgPrepMinutes:
            a.prepMinutes.length > 0
              ? Math.round((a.prepMinutes.reduce((s, m) => s + m, 0) / a.prepMinutes.length) * 10) / 10
              : 0,
        };
      })
      .filter((r) => r.orders > 0)
      .sort((a, b) => b.gmv - a.gmv);

    return rows;
  }

  async getCancellations(): Promise<CancellationRow[]> {
    const rows = await this.db
      .select({ status: orderStatusHistory.status, actorRole: orderStatusHistory.actorRole })
      .from(orderStatusHistory)
      .where(inArray(orderStatusHistory.status, ['failed', 'cancelled']));

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
      if (r.status === 'cancelled' && r.actorRole === 'admin') customer += 1;
      else if (r.status === 'failed' && r.actorRole === 'vendor') vendor += 1;
      else if (r.status === 'failed' && r.actorRole === 'system') noFulfillment += 1;
    }

    return [
      { cause: 'customer', count: customer },
      { cause: 'vendor', count: vendor },
      { cause: 'no_fulfillment', count: noFulfillment },
    ];
  }
}

function sumTotal(orders: { total: number }[]) {
  return Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100;
}
