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
var AllocationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllocationService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const catalog_types_1 = require("../catalog/catalog.types");
const job_queue_service_1 = require("./job-queue.service");
const payment_service_1 = require("../payment/payment.service");
const notification_service_1 = require("../notification/notification.service");
const allocation_failed_admin_1 = require("../notification/templates/email/allocation-failed-admin");
const order_cancelled_1 = require("../notification/templates/push/order-cancelled");
const allocation_constants_1 = require("./allocation.constants");
let AllocationService = AllocationService_1 = class AllocationService {
    db;
    jobQueue;
    payments;
    notifications;
    logger = new common_1.Logger(AllocationService_1.name);
    constructor(db, jobQueue, payments, notifications) {
        this.db = db;
        this.jobQueue = jobQueue;
        this.payments = payments;
        this.notifications = notifications;
    }
    async findBestVendor(items, lat, lng, excludeVendorIds = []) {
        const allVendors = await this.db.select().from(schema_1.vendors);
        const inRadius = allVendors.filter((v) => v.type !== 'restaurant' &&
            !excludeVendorIds.includes(v.id) &&
            (0, catalog_types_1.isVendorOpenNow)(v) &&
            (0, catalog_types_1.haversineKm)(lat, lng, v.pickupLat, v.pickupLng) <= v.radiusKm);
        if (inRadius.length === 0)
            return null;
        const productIds = items.map((i) => i.productId);
        const candidates = [];
        for (const vendor of inRadius) {
            const rows = await this.db
                .select()
                .from(schema_1.vendorProducts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, vendor.id), (0, drizzle_orm_1.inArray)(schema_1.vendorProducts.productId, productIds)));
            const byProduct = new Map(rows.map((r) => [r.productId, r]));
            const canFulfillAll = items.every((line) => {
                const vp = byProduct.get(line.productId);
                return vp && vp.isAvailable && vp.stockQty >= line.qty;
            });
            if (!canFulfillAll)
                continue;
            const totalCost = items.reduce((sum, line) => sum + byProduct.get(line.productId).price * line.qty, 0);
            candidates.push({
                vendorId: vendor.id,
                totalCost,
                distance: (0, catalog_types_1.haversineKm)(lat, lng, vendor.pickupLat, vendor.pickupLng),
                prices: new Map(rows.map((r) => [r.productId, r.price])),
            });
        }
        if (candidates.length === 0)
            return null;
        candidates.sort((a, b) => a.totalCost - b.totalCost || a.distance - b.distance);
        const winner = candidates[0];
        return { vendorId: winner.vendorId, unitPrices: winner.prices };
    }
    async createAttempt(groceryOrderId, vendorId, attemptNo) {
        const slaDeadline = new Date(Date.now() + allocation_constants_1.ALLOCATION_SLA_SECONDS * 1000);
        const [attempt] = await this.db
            .insert(schema_1.allocationAttempts)
            .values({ groceryOrderId, vendorId, attemptNo, outcome: 'pending', slaDeadline })
            .returning();
        this.jobQueue.schedule(attempt.id, allocation_constants_1.ALLOCATION_SLA_SECONDS * 1000, () => this.handleTimeout(attempt.id));
        return attempt;
    }
    async handleTimeout(attemptId) {
        const [attempt] = await this.db.select().from(schema_1.allocationAttempts).where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.id, attemptId)).limit(1);
        if (!attempt || attempt.outcome !== 'pending')
            return;
        this.logger.log(`Allocation attempt ${attemptId} timed out (vendor ${attempt.vendorId})`);
        await this.db.update(schema_1.allocationAttempts).set({ outcome: 'timeout' }).where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.id, attemptId));
        await this.reallocate(attempt.groceryOrderId);
    }
    async handleRejection(attemptId) {
        this.jobQueue.cancel(attemptId);
        await this.db.update(schema_1.allocationAttempts).set({ outcome: 'rejected' }).where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.id, attemptId));
        const [attempt] = await this.db.select().from(schema_1.allocationAttempts).where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.id, attemptId)).limit(1);
        if (attempt)
            await this.reallocate(attempt.groceryOrderId);
    }
    handleAcceptance(attemptId) {
        this.jobQueue.cancel(attemptId);
        return this.db.update(schema_1.allocationAttempts).set({ outcome: 'accepted' }).where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.id, attemptId));
    }
    async reallocate(groceryOrderId) {
        const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, groceryOrderId)).limit(1);
        if (!order || order.status !== 'placed')
            return;
        const previousAttempts = await this.db
            .select()
            .from(schema_1.allocationAttempts)
            .where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, groceryOrderId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.allocationAttempts.attemptNo));
        const nextAttemptNo = (previousAttempts[0]?.attemptNo ?? 0) + 1;
        if (nextAttemptNo > allocation_constants_1.MAX_ALLOCATION_ATTEMPTS) {
            await this.markFailed(groceryOrderId);
            return;
        }
        const items = await this.db.select().from(schema_1.groceryOrderItems).where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.groceryOrderId, groceryOrderId));
        const [address] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, order.deliveryAddressId)).limit(1);
        if (!address) {
            await this.markFailed(groceryOrderId);
            return;
        }
        const excludeVendorIds = previousAttempts.map((a) => a.vendorId);
        const candidate = await this.findBestVendor(items.map((i) => ({ productId: i.productId, qty: i.qty })), address.lat, address.lng, excludeVendorIds);
        if (!candidate) {
            await this.markFailed(groceryOrderId);
            return;
        }
        const subtotal = items.reduce((sum, i) => sum + (candidate.unitPrices.get(i.productId) ?? 0) * i.qty, 0);
        await this.db
            .update(schema_1.groceryOrders)
            .set({ vendorId: candidate.vendorId, subtotal, total: subtotal + order.deliveryFee })
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, groceryOrderId));
        for (const item of items) {
            const price = candidate.unitPrices.get(item.productId);
            if (price !== undefined) {
                await this.db.update(schema_1.groceryOrderItems).set({ unitPrice: price }).where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.id, item.id));
            }
        }
        await this.createAttempt(groceryOrderId, candidate.vendorId, nextAttemptNo);
    }
    async markFailed(groceryOrderId) {
        const [updated] = await this.db
            .update(schema_1.groceryOrders)
            .set({ status: 'failed' })
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, groceryOrderId))
            .returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            groceryOrderId,
            status: 'failed',
            actorRole: 'system',
        });
        await this.payments.markRefundPendingIfPaid('grocery', groceryOrderId);
        const orderCode = groceryOrderId.slice(0, 8).toUpperCase();
        this.notifications.notifyPush(updated.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(orderCode));
        await this.notifications.notifyAllAdminsEmail('allocation_failed', (0, allocation_failed_admin_1.allocationFailedAdminEmail)(orderCode));
    }
};
exports.AllocationService = AllocationService;
exports.AllocationService = AllocationService = AllocationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, job_queue_service_1.JobQueueService,
        payment_service_1.PaymentService,
        notification_service_1.NotificationService])
], AllocationService);
//# sourceMappingURL=allocation.service.js.map