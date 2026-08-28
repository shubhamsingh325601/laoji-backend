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
exports.SettlementService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
let SettlementService = class SettlementService {
    db;
    constructor(db) {
        this.db = db;
    }
    async vendorIdForUser(userId) {
        const [row] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Vendor profile not set up yet');
        return row.id;
    }
    async partnerIdForUser(userId) {
        const [row] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.userId, userId)).limit(1);
        if (!row)
            throw new common_1.NotFoundException('Delivery partner profile not set up yet');
        return row.id;
    }
    async generateForDeliveredOrder(type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            return null;
        const [settlement] = await this.db
            .insert(schema_1.settlements)
            .values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            vendorPayout: order.subtotal - order.platformCommission,
            deliveryPayout: order.deliveryFee,
            platformShare: order.platformCommission,
            commissionPctSnapshot: order.commissionPct,
        })
            .returning();
        return settlement;
    }
    async listForVendor(vendorId) {
        const groceryRows = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendorId));
        const restaurantRows = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendorId));
        const foodRows = restaurantRows.length
            ? await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.inArray)(schema_1.foodOrders.restaurantId, restaurantRows.map((r) => r.id)))
            : [];
        const groceryIds = groceryRows.map((o) => o.id);
        const foodIds = foodRows.map((o) => o.id);
        if (!groceryIds.length && !foodIds.length)
            return [];
        const [gSettlements, fSettlements] = await Promise.all([
            groceryIds.length ? this.db.select().from(schema_1.settlements).where((0, drizzle_orm_1.inArray)(schema_1.settlements.groceryOrderId, groceryIds)) : [],
            foodIds.length ? this.db.select().from(schema_1.settlements).where((0, drizzle_orm_1.inArray)(schema_1.settlements.foodOrderId, foodIds)) : [],
        ]);
        return [...gSettlements, ...fSettlements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((s) => this.toSummary(s));
    }
    async listForPartner(partnerId) {
        const groceryRows = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.deliveryPartnerId, partnerId));
        const foodRows = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.deliveryPartnerId, partnerId));
        const groceryIds = groceryRows.map((o) => o.id);
        const foodIds = foodRows.map((o) => o.id);
        if (!groceryIds.length && !foodIds.length)
            return [];
        const [gSettlements, fSettlements] = await Promise.all([
            groceryIds.length ? this.db.select().from(schema_1.settlements).where((0, drizzle_orm_1.inArray)(schema_1.settlements.groceryOrderId, groceryIds)) : [],
            foodIds.length ? this.db.select().from(schema_1.settlements).where((0, drizzle_orm_1.inArray)(schema_1.settlements.foodOrderId, foodIds)) : [],
        ]);
        return [...gSettlements, ...fSettlements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((s) => this.toSummary(s));
    }
    toSummary(s) {
        return {
            id: s.id,
            type: (s.groceryOrderId ? 'grocery' : 'food'),
            orderId: (s.groceryOrderId ?? s.foodOrderId),
            orderCode: (s.groceryOrderId ?? s.foodOrderId).slice(0, 8).toUpperCase(),
            vendorPayout: s.vendorPayout,
            deliveryPayout: s.deliveryPayout,
            platformShare: s.platformShare,
            commissionPctSnapshot: s.commissionPctSnapshot,
            createdAt: s.createdAt,
        };
    }
    async requestVendorWithdrawal(userId) {
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId)).limit(1);
        if (!vendor)
            throw new common_1.NotFoundException('Vendor profile not set up yet');
        if (vendor.kycStatus !== 'verified') {
            throw new common_1.BadRequestException('KYC verification required before withdrawal. Please upload your Aadhaar card (front and back) to complete verification.');
        }
        const settlementsList = await this.listForVendor(vendor.id);
        const totalEarnings = settlementsList.reduce((sum, s) => sum + s.vendorPayout, 0);
        return {
            success: true,
            message: 'Withdrawal request submitted successfully. Funds will be transferred to your registered bank / UPI account.',
            availableBalance: totalEarnings,
            kycStatus: vendor.kycStatus,
        };
    }
    async requestPartnerWithdrawal(userId) {
        const [partner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.userId, userId)).limit(1);
        if (!partner)
            throw new common_1.NotFoundException('Delivery partner profile not set up yet');
        if (partner.kycStatus !== 'verified') {
            throw new common_1.BadRequestException('KYC verification required before withdrawal. Please upload your Aadhaar card (front and back) to complete verification.');
        }
        const settlementsList = await this.listForPartner(partner.id);
        const totalEarnings = settlementsList.reduce((sum, s) => sum + s.deliveryPayout, 0);
        return {
            success: true,
            message: 'Withdrawal request submitted successfully. Funds will be transferred to your registered bank / UPI account.',
            availableBalance: totalEarnings,
            kycStatus: partner.kycStatus,
        };
    }
    async listAllForAdmin() {
        const rows = await this.db.select().from(schema_1.settlements).orderBy((0, drizzle_orm_1.desc)(schema_1.settlements.createdAt)).limit(200);
        return rows.map((s) => this.toSummary(s));
    }
};
exports.SettlementService = SettlementService;
exports.SettlementService = SettlementService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], SettlementService);
//# sourceMappingURL=settlement.service.js.map