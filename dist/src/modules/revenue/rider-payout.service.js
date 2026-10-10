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
exports.RiderPayoutService = exports.DEFAULT_RIDER_PAYOUT_TIERS = void 0;
exports.validateRiderPayoutTiers = validateRiderPayoutTiers;
exports.riderPayoutForDistance = riderPayoutForDistance;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const catalog_types_1 = require("../catalog/catalog.types");
exports.DEFAULT_RIDER_PAYOUT_TIERS = [
    { fromKm: 0, toKm: 3, amount: 5 },
    { fromKm: 3, toKm: 5, amount: 10 },
    { fromKm: 5, toKm: null, amount: 15 },
];
const MAX_TIERS = 20;
function validateRiderPayoutTiers(tiers) {
    if (!Array.isArray(tiers) || tiers.length === 0) {
        throw new common_1.BadRequestException('Add at least one distance range');
    }
    if (tiers.length > MAX_TIERS)
        throw new common_1.BadRequestException(`At most ${MAX_TIERS} ranges are allowed`);
    const out = tiers.map((t, i) => {
        const fromKm = Number(t?.fromKm);
        const toKm = t?.toKm === null || t?.toKm === undefined ? null : Number(t.toKm);
        const amount = Number(t?.amount);
        const label = `Range ${i + 1}`;
        if (!Number.isFinite(fromKm) || fromKm < 0)
            throw new common_1.BadRequestException(`${label}: "from" km must be 0 or more`);
        if (toKm !== null && (!Number.isFinite(toKm) || toKm <= fromKm)) {
            throw new common_1.BadRequestException(`${label}: "to" km must be greater than "from" km`);
        }
        if (!Number.isFinite(amount) || amount < 0)
            throw new common_1.BadRequestException(`${label}: amount must be 0 or more`);
        return { fromKm, toKm, amount: Math.round(amount * 100) / 100 };
    });
    if (out[0].fromKm !== 0)
        throw new common_1.BadRequestException('The first range must start at 0 km');
    for (let i = 0; i < out.length; i++) {
        const last = i === out.length - 1;
        if (last && out[i].toKm !== null) {
            throw new common_1.BadRequestException('The last range must have no upper limit (e.g. "5 km and above")');
        }
        if (!last) {
            if (out[i].toKm === null)
                throw new common_1.BadRequestException(`Range ${i + 1}: only the last range can have no upper limit`);
            if (out[i + 1].fromKm !== out[i].toKm) {
                throw new common_1.BadRequestException(`Range ${i + 2} must start at ${out[i].toKm} km, where range ${i + 1} ends — no gaps or overlaps`);
            }
        }
    }
    return out;
}
function riderPayoutForDistance(tiers, distanceKm) {
    const sorted = [...tiers].sort((a, b) => a.fromKm - b.fromKm);
    const hit = sorted.find((t, i) => (i === 0 || distanceKm > t.fromKm) && (t.toKm === null || distanceKm <= t.toKm));
    return (hit ?? sorted[sorted.length - 1]).amount;
}
let RiderPayoutService = class RiderPayoutService {
    db;
    constructor(db) {
        this.db = db;
    }
    async listTiers() {
        const rows = await this.db.select().from(schema_1.riderPayoutTiers).orderBy((0, drizzle_orm_1.asc)(schema_1.riderPayoutTiers.fromKm));
        if (!rows.length)
            return exports.DEFAULT_RIDER_PAYOUT_TIERS;
        return rows.map((r) => ({ fromKm: r.fromKm, toKm: r.toKm, amount: r.amount }));
    }
    async replaceTiers(tiers) {
        const valid = validateRiderPayoutTiers(tiers);
        await this.db.transaction(async (tx) => {
            await tx.delete(schema_1.riderPayoutTiers);
            await tx.insert(schema_1.riderPayoutTiers).values(valid);
        });
        return valid;
    }
    async forOrder(type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            return 0;
        if (order.riderPayout !== null && order.riderPayout !== undefined)
            return order.riderPayout;
        const tiers = await this.listTiers();
        const km = await this.pickupToDropKm(type, order);
        if (km === null)
            return riderPayoutForDistance(tiers, 0);
        const amount = riderPayoutForDistance(tiers, km);
        await this.db.update(table).set({ riderPayout: amount }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.id, orderId), (0, drizzle_orm_1.isNull)(table.riderPayout)));
        return amount;
    }
    async pickupToDropKm(type, order) {
        let vendorId = order.vendorId;
        if (type === 'food' && order.restaurantId) {
            const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
            vendorId = restaurant?.vendorId;
        }
        if (!vendorId)
            return null;
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId)).limit(1);
        const [address] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, order.deliveryAddressId)).limit(1);
        if (!vendor || !address)
            return null;
        return (0, catalog_types_1.haversineKm)(vendor.pickupLat, vendor.pickupLng, address.lat, address.lng);
    }
};
exports.RiderPayoutService = RiderPayoutService;
exports.RiderPayoutService = RiderPayoutService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], RiderPayoutService);
//# sourceMappingURL=rider-payout.service.js.map