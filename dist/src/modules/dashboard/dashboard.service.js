"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const TERMINAL_STATUSES = ['delivered', 'failed', 'cancelled'];
const STUCK_SLA_MINUTES = {
    placed: 5,
    vendor_accepted: 20,
    preparing: 30,
    ready: 15,
    handed_over: 45,
    delivery_assigned: 45,
    picked_up: 45,
    out_for_delivery: 45,
};
function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function code(id) {
    return id.slice(0, 8).toUpperCase();
}
let DashboardService = class DashboardService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getStats() {
        const todayStart = startOfDay(new Date());
        const lastWeekStart = new Date(todayStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(todayStart);
        const [groceryToday, foodToday, groceryLastWeek, foodLastWeek] = await Promise.all([
            this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.gte)(schema_1.groceryOrders.createdAt, todayStart)),
            this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.gte)(schema_1.foodOrders.createdAt, todayStart)),
            this.db
                .select()
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.groceryOrders.createdAt, lastWeekStart), (0, drizzle_orm_1.lt)(schema_1.groceryOrders.createdAt, lastWeekEnd))),
            this.db
                .select()
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.foodOrders.createdAt, lastWeekStart), (0, drizzle_orm_1.lt)(schema_1.foodOrders.createdAt, lastWeekEnd))),
        ]);
        const gmvToday = sumTotal(groceryToday) + sumTotal(foodToday);
        const gmvLastWeek = sumTotal(groceryLastWeek) + sumTotal(foodLastWeek);
        const gmvDeltaPct = gmvLastWeek > 0 ? Math.round(((gmvToday - gmvLastWeek) / gmvLastWeek) * 1000) / 10 : 0;
        const [allVendors, allPartners, pendingSuggestionsRows] = await Promise.all([
            this.db.select().from(schema_1.vendors),
            this.db.select().from(schema_1.deliveryPartners),
            this.db.select().from(schema_1.productSuggestions).where((0, drizzle_orm_1.eq)(schema_1.productSuggestions.status, 'pending')),
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
            pendingKyc: allVendors.filter((v) => v.kycStatus === 'pending').length +
                allPartners.filter((p) => p.kycStatus === 'pending').length,
            pendingSuggestions: pendingSuggestionsRows.length,
        };
    }
    async getAttention() {
        const nonTerminal = Object.keys(STUCK_SLA_MINUTES);
        const [groceryOpen, foodOpen] = await Promise.all([
            this.db
                .select({
                id: schema_1.groceryOrders.id,
                status: schema_1.groceryOrders.status,
                total: schema_1.groceryOrders.total,
                vendorId: schema_1.groceryOrders.vendorId,
            })
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.inArray)(schema_1.groceryOrders.status, nonTerminal)),
            this.db
                .select({
                id: schema_1.foodOrders.id,
                status: schema_1.foodOrders.status,
                total: schema_1.foodOrders.total,
                restaurantId: schema_1.foodOrders.restaurantId,
            })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.inArray)(schema_1.foodOrders.status, nonTerminal)),
        ]);
        const groceryIds = groceryOpen.map((o) => o.id);
        const foodIds = foodOpen.map((o) => o.id);
        const vendorNames = await this.vendorNameMap(groceryOpen.map((o) => o.vendorId));
        const restaurantNames = await this.restaurantNameMap(foodOpen.map((o) => o.restaurantId));
        const latestChangeByOrder = await this.latestStatusChangeMap(groceryIds, foodIds);
        const now = Date.now();
        const items = [];
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
        const since = new Date(now - 24 * 60 * 60 * 1000);
        const [recentFailedGrocery, recentFailedFood] = await Promise.all([
            this.db
                .select({ id: schema_1.groceryOrders.id, total: schema_1.groceryOrders.total, vendorId: schema_1.groceryOrders.vendorId })
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'failed'), (0, drizzle_orm_1.gte)(schema_1.groceryOrders.createdAt, since))),
            this.db
                .select({ id: schema_1.foodOrders.id, total: schema_1.foodOrders.total, restaurantId: schema_1.foodOrders.restaurantId })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'failed'), (0, drizzle_orm_1.gte)(schema_1.foodOrders.createdAt, since))),
        ]);
        const failedChangeByOrder = await this.latestStatusChangeMap(recentFailedGrocery.map((o) => o.id), recentFailedFood.map((o) => o.id));
        const failedVendorNames = await this.vendorNameMap(recentFailedGrocery.map((o) => o.vendorId));
        for (const o of recentFailedGrocery) {
            const changedAt = failedChangeByOrder.get(o.id);
            if (!changedAt)
                continue;
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
        void recentFailedFood;
        return items.sort((a, b) => b.minutesWaiting - a.minutesWaiting).slice(0, 20);
    }
    pushStuckIfDue(items, id, status, changedAt, now, place) {
        const thresholdMinutes = STUCK_SLA_MINUTES[status];
        if (!thresholdMinutes || !changedAt)
            return;
        const minutesWaiting = Math.round((now - changedAt.getTime()) / 60000);
        if (minutesWaiting <= thresholdMinutes)
            return;
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
    async latestStatusChangeMap(groceryIds, foodIds) {
        const map = new Map();
        if (groceryIds.length === 0 && foodIds.length === 0)
            return map;
        const conditions = [];
        if (groceryIds.length)
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.orderStatusHistory.groceryOrderId, groceryIds));
        if (foodIds.length)
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.orderStatusHistory.foodOrderId, foodIds));
        const rows = await this.db
            .select({
            groceryOrderId: schema_1.orderStatusHistory.groceryOrderId,
            foodOrderId: schema_1.orderStatusHistory.foodOrderId,
            changedAt: schema_1.orderStatusHistory.changedAt,
        })
            .from(schema_1.orderStatusHistory)
            .where((0, drizzle_orm_1.or)(...conditions));
        for (const r of rows) {
            const orderId = r.groceryOrderId ?? r.foodOrderId;
            const existing = map.get(orderId);
            if (!existing || r.changedAt > existing)
                map.set(orderId, r.changedAt);
        }
        return map;
    }
    async vendorNameMap(vendorIds) {
        const ids = [...new Set(vendorIds.filter((v) => !!v))];
        if (ids.length === 0)
            return new Map();
        const rows = await this.db
            .select({ id: schema_1.vendors.id, businessName: schema_1.vendors.businessName })
            .from(schema_1.vendors)
            .where((0, drizzle_orm_1.inArray)(schema_1.vendors.id, ids));
        return new Map(rows.map((r) => [r.id, r.businessName]));
    }
    async restaurantNameMap(restaurantIds) {
        const ids = [...new Set(restaurantIds)];
        if (ids.length === 0)
            return new Map();
        const rows = await this.db
            .select({ id: schema_1.restaurants.id, name: schema_1.restaurants.name })
            .from(schema_1.restaurants)
            .where((0, drizzle_orm_1.inArray)(schema_1.restaurants.id, ids));
        return new Map(rows.map((r) => [r.id, r.name]));
    }
    async getSeries(days) {
        const start = startOfDay(new Date());
        start.setDate(start.getDate() - (days - 1));
        const [grocery, food] = await Promise.all([
            this.db
                .select({
                createdAt: schema_1.groceryOrders.createdAt,
                status: schema_1.groceryOrders.status,
                platformCommission: schema_1.groceryOrders.platformCommission,
            })
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.gte)(schema_1.groceryOrders.createdAt, start)),
            this.db
                .select({
                createdAt: schema_1.foodOrders.createdAt,
                status: schema_1.foodOrders.status,
                platformCommission: schema_1.foodOrders.platformCommission,
            })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.gte)(schema_1.foodOrders.createdAt, start)),
        ]);
        const buckets = new Map();
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            buckets.set(dayKey(d), { grocery: 0, food: 0, revenue: 0 });
        }
        for (const o of grocery) {
            const b = buckets.get(dayKey(o.createdAt));
            if (!b)
                continue;
            b.grocery += 1;
            if (o.status === 'delivered')
                b.revenue += o.platformCommission;
        }
        for (const o of food) {
            const b = buckets.get(dayKey(o.createdAt));
            if (!b)
                continue;
            b.food += 1;
            if (o.status === 'delivered')
                b.revenue += o.platformCommission;
        }
        return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
    }
    async getVendorPerformance() {
        const [allVendors, allRestaurants, allGrocery, allFood, attempts, history] = await Promise.all([
            this.db.select().from(schema_1.vendors),
            this.db.select().from(schema_1.restaurants),
            this.db.select().from(schema_1.groceryOrders),
            this.db.select().from(schema_1.foodOrders),
            this.db.select().from(schema_1.allocationAttempts),
            this.db.select().from(schema_1.orderStatusHistory),
        ]);
        const restaurantVendorId = new Map(allRestaurants.map((r) => [r.id, r.vendorId]));
        const agg = new Map();
        const ensure = (vendorId) => {
            let a = agg.get(vendorId);
            if (!a) {
                a = { orders: 0, gmv: 0, accepted: 0, rejected: 0, prepMinutes: [] };
                agg.set(vendorId, a);
            }
            return a;
        };
        const acceptedAt = new Map();
        const readyAt = new Map();
        for (const h of history) {
            const orderId = h.groceryOrderId ?? h.foodOrderId;
            if (!orderId)
                continue;
            if (h.status === 'vendor_accepted')
                acceptedAt.set(orderId, h.changedAt);
            if (h.status === 'ready')
                readyAt.set(orderId, h.changedAt);
        }
        for (const o of allGrocery) {
            if (!o.vendorId)
                continue;
            const a = ensure(o.vendorId);
            a.orders += 1;
            a.gmv += o.total;
            const start = acceptedAt.get(o.id);
            const end = readyAt.get(o.id);
            if (start && end && end > start)
                a.prepMinutes.push((end.getTime() - start.getTime()) / 60000);
        }
        for (const o of allFood) {
            const vendorId = restaurantVendorId.get(o.restaurantId);
            if (!vendorId)
                continue;
            const a = ensure(vendorId);
            a.orders += 1;
            a.gmv += o.total;
            const start = acceptedAt.get(o.id);
            const end = readyAt.get(o.id);
            if (start && end && end > start)
                a.prepMinutes.push((end.getTime() - start.getTime()) / 60000);
            if (acceptedAt.has(o.id))
                ensure(vendorId).accepted += 1;
            else if (o.status === 'failed')
                ensure(vendorId).rejected += 1;
        }
        for (const at of attempts) {
            const a = ensure(at.vendorId);
            if (at.outcome === 'accepted')
                a.accepted += 1;
            else if (at.outcome === 'rejected' || at.outcome === 'timeout')
                a.rejected += 1;
        }
        const rows = [...agg.entries()]
            .map(([vendorId, a]) => {
            const vendor = allVendors.find((v) => v.id === vendorId);
            const decided = a.accepted + a.rejected;
            return {
                vendorId,
                vendorName: vendor?.businessName ?? 'Unknown vendor',
                orders: a.orders,
                gmv: Math.round(a.gmv * 100) / 100,
                acceptanceRate: decided > 0 ? Math.round((a.accepted / decided) * 1000) / 10 : 0,
                avgPrepMinutes: a.prepMinutes.length > 0
                    ? Math.round((a.prepMinutes.reduce((s, m) => s + m, 0) / a.prepMinutes.length) * 10) / 10
                    : 0,
            };
        })
            .filter((r) => r.orders > 0)
            .sort((a, b) => b.gmv - a.gmv);
        return rows;
    }
    async getCancellations() {
        const rows = await this.db
            .select({ status: schema_1.orderStatusHistory.status, actorRole: schema_1.orderStatusHistory.actorRole })
            .from(schema_1.orderStatusHistory)
            .where((0, drizzle_orm_1.inArray)(schema_1.orderStatusHistory.status, ['failed', 'cancelled']));
        let customer = 0;
        let vendor = 0;
        let noFulfillment = 0;
        for (const r of rows) {
            if (r.status === 'cancelled' && r.actorRole === 'admin')
                customer += 1;
            else if (r.status === 'failed' && r.actorRole === 'vendor')
                vendor += 1;
            else if (r.status === 'failed' && r.actorRole === 'system')
                noFulfillment += 1;
        }
        return [
            { cause: 'customer', count: customer },
            { cause: 'vendor', count: vendor },
            { cause: 'no_fulfillment', count: noFulfillment },
        ];
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], DashboardService);
function sumTotal(orders) {
    return Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100;
}
//# sourceMappingURL=dashboard.service.js.map