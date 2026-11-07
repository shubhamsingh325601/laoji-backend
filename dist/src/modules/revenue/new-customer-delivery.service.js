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
exports.NewCustomerDeliveryService = exports.DEFAULT_NEW_CUSTOMER_DELIVERY = void 0;
exports.validateNewCustomerDelivery = validateNewCustomerDelivery;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const rider_payout_service_1 = require("./rider-payout.service");
exports.DEFAULT_NEW_CUSTOMER_DELIVERY = { enabled: true, maxKm: 5, maxOrders: 3 };
function validateNewCustomerDelivery(input) {
    const i = (input ?? {});
    const maxKm = Number(i.maxKm);
    const maxOrders = Number(i.maxOrders);
    if (typeof i.enabled !== 'boolean')
        throw new common_1.BadRequestException('"enabled" must be true or false');
    if (!Number.isFinite(maxKm) || maxKm <= 0)
        throw new common_1.BadRequestException('Distance limit must be more than 0 km');
    if (!Number.isInteger(maxOrders) || maxOrders < 0)
        throw new common_1.BadRequestException('Number of orders must be a whole number, 0 or more');
    return { enabled: i.enabled, maxKm: Math.round(maxKm * 100) / 100, maxOrders };
}
const NOT_COUNTED = ['failed', 'cancelled'];
let NewCustomerDeliveryService = class NewCustomerDeliveryService {
    db;
    constructor(db) {
        this.db = db;
    }
    async get() {
        const [row] = await this.db.select().from(schema_1.newCustomerDeliverySettings).limit(1);
        return row ? { enabled: row.enabled, maxKm: row.maxKm, maxOrders: row.maxOrders } : exports.DEFAULT_NEW_CUSTOMER_DELIVERY;
    }
    async save(input) {
        const valid = validateNewCustomerDelivery(input);
        await this.db.transaction(async (tx) => {
            await tx.delete(schema_1.newCustomerDeliverySettings);
            await tx.insert(schema_1.newCustomerDeliverySettings).values(valid);
        });
        return valid;
    }
    async listFeeTiers() {
        const rows = await this.db.select().from(schema_1.customerDeliveryFeeTiers).orderBy((0, drizzle_orm_1.asc)(schema_1.customerDeliveryFeeTiers.fromKm));
        return rows.map((r) => ({ fromKm: r.fromKm, toKm: r.toKm, amount: r.amount }));
    }
    async replaceFeeTiers(tiers) {
        const valid = (0, rider_payout_service_1.validateRiderPayoutTiers)(tiers);
        await this.db.transaction(async (tx) => {
            await tx.delete(schema_1.customerDeliveryFeeTiers);
            await tx.insert(schema_1.customerDeliveryFeeTiers).values(valid);
        });
        return valid;
    }
    async feeForDistance(distanceKm) {
        const tiers = await this.listFeeTiers();
        return tiers.length ? (0, rider_payout_service_1.riderPayoutForDistance)(tiers, distanceKm) : null;
    }
    async ordersPlaced(customerIds) {
        const out = new Map();
        if (!customerIds.length)
            return out;
        const [g, f] = await Promise.all([
            this.db
                .select({ id: schema_1.groceryOrders.customerId, n: (0, drizzle_orm_1.count)() })
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.groceryOrders.customerId, customerIds), (0, drizzle_orm_1.notInArray)(schema_1.groceryOrders.status, [...NOT_COUNTED])))
                .groupBy(schema_1.groceryOrders.customerId),
            this.db
                .select({ id: schema_1.foodOrders.customerId, n: (0, drizzle_orm_1.count)() })
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.foodOrders.customerId, customerIds), (0, drizzle_orm_1.notInArray)(schema_1.foodOrders.status, [...NOT_COUNTED])))
                .groupBy(schema_1.foodOrders.customerId),
        ]);
        for (const r of [...g, ...f])
            out.set(r.id, (out.get(r.id) ?? 0) + r.n);
        return out;
    }
    async extras(customerIds) {
        if (!customerIds.length)
            return new Map();
        const rows = await this.db.select().from(schema_1.customerFreeDeliveryBonus).where((0, drizzle_orm_1.inArray)(schema_1.customerFreeDeliveryBonus.customerId, customerIds));
        return new Map(rows.map((r) => [r.customerId, r.extraOrders]));
    }
    async offerFor(customerId, distanceKm) {
        const rule = await this.get();
        if (!rule.enabled)
            return { applied: false, remaining: 0 };
        const [placed, extra] = await Promise.all([this.ordersPlaced([customerId]), this.extras([customerId])]);
        const remaining = Math.max(0, rule.maxOrders + (extra.get(customerId) ?? 0) - (placed.get(customerId) ?? 0));
        return { applied: remaining > 0 && distanceKm <= rule.maxKm, remaining };
    }
    async listCustomers(search) {
        const rule = await this.get();
        const term = search?.trim();
        const where = term
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.role, 'customer'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.users.phone, `%${term}%`), (0, drizzle_orm_1.ilike)(schema_1.users.name, `%${term}%`)))
            : (0, drizzle_orm_1.eq)(schema_1.users.role, 'customer');
        const rows = await this.db.select().from(schema_1.users).where(where).orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt)).limit(50);
        return { settings: rule, customers: await this.statuses(rows, rule) };
    }
    async statuses(rows, rule) {
        const ids = rows.map((r) => r.id);
        const [placed, extra] = await Promise.all([this.ordersPlaced(ids), this.extras(ids)]);
        return rows.map((u) => {
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
    async setExtra(customerId, extraOrders) {
        const extra = Number(extraOrders);
        if (!Number.isInteger(extra) || extra < 0 || extra > 100) {
            throw new common_1.BadRequestException('Extra free deliveries must be a whole number from 0 to 100');
        }
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.id, customerId), (0, drizzle_orm_1.eq)(schema_1.users.role, 'customer'))).limit(1);
        if (!user)
            throw new common_1.NotFoundException('Customer not found');
        await this.db
            .insert(schema_1.customerFreeDeliveryBonus)
            .values({ customerId, extraOrders: extra })
            .onConflictDoUpdate({ target: schema_1.customerFreeDeliveryBonus.customerId, set: { extraOrders: extra, updatedAt: new Date() } });
        const [status] = await this.statuses([user], await this.get());
        return status;
    }
    async listFreeThresholdTiers() {
        const rows = await this.db.select().from(schema_1.deliveryFreeThresholdTiers).orderBy((0, drizzle_orm_1.asc)(schema_1.deliveryFreeThresholdTiers.fromKm));
        return rows.map((r) => ({ fromKm: r.fromKm, toKm: r.toKm, minOrderAmount: r.minOrderAmount }));
    }
    async replaceFreeThresholdTiers(tiers) {
        if (!Array.isArray(tiers) || tiers.length === 0) {
            await this.db.delete(schema_1.deliveryFreeThresholdTiers);
            return [];
        }
        const validated = this.validateFreeThresholdTiers(tiers);
        await this.db.transaction(async (tx) => {
            await tx.delete(schema_1.deliveryFreeThresholdTiers);
            await tx.insert(schema_1.deliveryFreeThresholdTiers).values(validated);
        });
        return validated;
    }
    validateFreeThresholdTiers(tiers) {
        const out = tiers.map((t, i) => {
            const fromKm = Number(t?.fromKm);
            const toKm = t?.toKm === null || t?.toKm === undefined ? null : Number(t.toKm);
            const minOrderAmount = Number(t?.minOrderAmount);
            const label = `Band ${i + 1}`;
            if (!Number.isFinite(fromKm) || fromKm < 0)
                throw new common_1.BadRequestException(`${label}: "from" km must be 0 or more`);
            if (toKm !== null && (!Number.isFinite(toKm) || toKm <= fromKm)) {
                throw new common_1.BadRequestException(`${label}: "to" km must be greater than "from" km`);
            }
            if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
                throw new common_1.BadRequestException(`${label}: minimum order amount must be 0 or more`);
            }
            return { fromKm, toKm, minOrderAmount: Math.round(minOrderAmount * 100) / 100 };
        });
        if (out[0].fromKm !== 0)
            throw new common_1.BadRequestException('The first band must start at 0 km');
        for (let i = 0; i < out.length; i++) {
            const last = i === out.length - 1;
            if (last && out[i].toKm !== null)
                throw new common_1.BadRequestException('The last band must have no upper limit');
            if (!last) {
                if (out[i].toKm === null)
                    throw new common_1.BadRequestException(`Band ${i + 1}: only the last band can have no upper limit`);
                if (out[i + 1].fromKm !== out[i].toKm) {
                    throw new common_1.BadRequestException(`Band ${i + 2} must start at ${out[i].toKm} km — no gaps or overlaps`);
                }
            }
        }
        return out;
    }
    async freeDeliveryThreshold(distanceKm, globalThreshold) {
        const tiers = await this.listFreeThresholdTiers();
        if (!tiers.length)
            return globalThreshold;
        const sorted = [...tiers].sort((a, b) => a.fromKm - b.fromKm);
        const hit = sorted.find((t, i) => (i === 0 || distanceKm > t.fromKm) && (t.toKm === null || distanceKm <= t.toKm));
        return (hit ?? sorted[sorted.length - 1]).minOrderAmount;
    }
};
exports.NewCustomerDeliveryService = NewCustomerDeliveryService;
exports.NewCustomerDeliveryService = NewCustomerDeliveryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], NewCustomerDeliveryService);
//# sourceMappingURL=new-customer-delivery.service.js.map