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
var DeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const catalog_types_1 = require("../catalog/catalog.types");
const job_queue_service_1 = require("../allocation/job-queue.service");
const payment_service_1 = require("../payment/payment.service");
const notification_service_1 = require("../notification/notification.service");
const ready_for_pickup_1 = require("../notification/templates/push/ready-for-pickup");
const delivery_assigned_1 = require("../notification/templates/push/delivery-assigned");
const picked_up_1 = require("../notification/templates/push/picked-up");
const out_for_delivery_1 = require("../notification/templates/push/out-for-delivery");
const delivered_1 = require("../notification/templates/push/delivered");
const order_cancelled_1 = require("../notification/templates/push/order-cancelled");
const settlement_service_1 = require("../revenue/settlement.service");
const settlement_summary_1 = require("../notification/templates/email/settlement-summary");
const delivery_constants_1 = require("./delivery.constants");
const DELIVERY_SEQUENCE = ['delivery_assigned', 'picked_up', 'out_for_delivery', 'delivered'];
let DeliveryService = DeliveryService_1 = class DeliveryService {
    db;
    jobQueue;
    payments;
    notifications;
    settlements;
    logger = new common_1.Logger(DeliveryService_1.name);
    constructor(db, jobQueue, payments, notifications, settlements) {
        this.db = db;
        this.jobQueue = jobQueue;
        this.payments = payments;
        this.notifications = notifications;
        this.settlements = settlements;
    }
    orderCode(orderId) {
        return orderId.slice(0, 8).toUpperCase();
    }
    async vendorUserIdForOrder(type, orderId) {
        let vendorId;
        if (type === 'grocery') {
            const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId)).limit(1);
            vendorId = order?.vendorId ?? undefined;
        }
        else {
            const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId)).limit(1);
            const [restaurant] = order ? await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1) : [];
            vendorId = restaurant?.vendorId;
        }
        if (!vendorId)
            return null;
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId)).limit(1);
        return vendor?.userId ?? null;
    }
    async getPartnerByUserId(userId) {
        const [row] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.userId, userId)).limit(1);
        return row ?? null;
    }
    async requirePartner(userId) {
        const partner = await this.getPartnerByUserId(userId);
        if (!partner)
            throw new common_1.NotFoundException('Delivery partner profile not set up yet');
        return partner;
    }
    async enrichProfile(partner) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, partner.userId)).limit(1);
        const groceryDone = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.deliveryPartnerId, partner.id), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivered')));
        const foodDone = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.deliveryPartnerId, partner.id), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivered')));
        const totalDeliveries = groceryDone.length + foodDone.length;
        const rejectedDocs = await this.db
            .select()
            .from(schema_1.kycDocuments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.kycDocuments.userId, partner.userId), (0, drizzle_orm_1.eq)(schema_1.kycDocuments.status, 'rejected')));
        return {
            id: partner.id,
            userId: partner.userId,
            name: null,
            phone: user?.phone ?? null,
            kycStatus: partner.kycStatus,
            vehicleType: partner.vehicleType,
            vehicleLabel: null,
            isOnline: partner.isOnline,
            currentLat: partner.currentLat,
            currentLng: partner.currentLng,
            rating: null,
            totalDeliveries,
            city: null,
            joinedAt: partner.createdAt,
            kycRejectionReasons: rejectedDocs.map((d) => d.rejectionReason).filter((r) => !!r),
            updatedAt: partner.updatedAt,
        };
    }
    async upsertProfile(userId, vehicleType) {
        const existing = await this.getPartnerByUserId(userId);
        if (existing) {
            const [updated] = await this.db
                .update(schema_1.deliveryPartners)
                .set({ vehicleType })
                .where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, existing.id))
                .returning();
            return this.enrichProfile(updated);
        }
        const [created] = await this.db.insert(schema_1.deliveryPartners).values({ userId, vehicleType }).returning();
        return this.enrichProfile(created);
    }
    async getEnrichedProfile(userId) {
        const partner = await this.requirePartner(userId);
        return this.enrichProfile(partner);
    }
    async setOnline(userId, isOnline) {
        const partner = await this.requirePartner(userId);
        const [updated] = await this.db
            .update(schema_1.deliveryPartners)
            .set({ isOnline, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, partner.id))
            .returning();
        return this.enrichProfile(updated);
    }
    async updateLocation(userId, lat, lng) {
        const partner = await this.requirePartner(userId);
        const [updated] = await this.db
            .update(schema_1.deliveryPartners)
            .set({ currentLat: lat, currentLng: lng, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, partner.id))
            .returning();
        return this.enrichProfile(updated);
    }
    async getHistoryForPartner(userId) {
        const partner = await this.requirePartner(userId);
        const grocery = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.deliveryPartnerId, partner.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivered'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'failed'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'cancelled'))));
        const food = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.deliveryPartnerId, partner.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivered'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'failed'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'cancelled'))));
        const vendorIds = [...new Set(grocery.map((o) => o.vendorId).filter((id) => !!id))];
        const vendorRows = vendorIds.length ? await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.inArray)(schema_1.vendors.id, vendorIds)) : [];
        const vendorNameById = new Map(vendorRows.map((v) => [v.id, v.businessName]));
        const restaurantIds = [...new Set(food.map((o) => o.restaurantId))];
        const restaurantRows = restaurantIds.length ? await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.inArray)(schema_1.restaurants.id, restaurantIds)) : [];
        const restaurantNameById = new Map(restaurantRows.map((r) => [r.id, r.name]));
        const rows = [
            ...grocery.map((o) => ({
                id: o.id,
                orderId: o.id,
                orderCode: o.id.slice(0, 8).toUpperCase(),
                type: 'grocery',
                route: vendorNameById.get(o.vendorId ?? '') ?? 'Pickup',
                payout: o.deliveryFee,
                status: (o.status === 'delivered' ? 'delivered' : 'cancelled'),
                completedAt: o.createdAt,
            })),
            ...food.map((o) => ({
                id: o.id,
                orderId: o.id,
                orderCode: o.id.slice(0, 8).toUpperCase(),
                type: 'food',
                route: restaurantNameById.get(o.restaurantId) ?? 'Pickup',
                payout: o.deliveryFee,
                status: (o.status === 'delivered' ? 'delivered' : 'cancelled'),
                completedAt: o.createdAt,
            })),
        ];
        return rows.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    }
    async getEarningsForPartner(userId) {
        await this.requirePartner(userId);
        const recent = (await this.getHistoryForPartner(userId)).slice(0, 20);
        const delivered = recent.filter((r) => r.status === 'delivered');
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const todayRows = delivered.filter((r) => now - r.completedAt.getTime() < dayMs);
        const weekRows = delivered.filter((r) => now - r.completedAt.getTime() < 7 * dayMs);
        const today = { amount: todayRows.reduce((s, r) => s + r.payout, 0), deliveries: todayRows.length };
        const week = { amount: weekRows.reduce((s, r) => s + r.payout, 0), deliveries: weekRows.length };
        const avgPerDelivery = week.deliveries > 0 ? Math.round(week.amount / week.deliveries) : 0;
        return { today, week, avgPerDelivery, nextPayoutDate: null, recent };
    }
    async findNearestOnlinePartner(lat, lng, excludePartnerIds) {
        const online = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.isOnline, true));
        const candidates = online.filter((p) => !excludePartnerIds.includes(p.id) && p.currentLat !== null && p.currentLng !== null);
        if (candidates.length === 0)
            return null;
        let best = candidates[0];
        let bestDistance = (0, catalog_types_1.haversineKm)(lat, lng, best.currentLat, best.currentLng);
        for (const p of candidates.slice(1)) {
            const d = (0, catalog_types_1.haversineKm)(lat, lng, p.currentLat, p.currentLng);
            if (d < bestDistance) {
                best = p;
                bestDistance = d;
            }
        }
        return best;
    }
    async pickupPoint(type, orderId) {
        if (type === 'grocery') {
            const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId)).limit(1);
            if (!order?.vendorId)
                return null;
            const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, order.vendorId)).limit(1);
            return vendor ? { lat: vendor.pickupLat, lng: vendor.pickupLng } : null;
        }
        const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId)).limit(1);
        if (!order)
            return null;
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
        if (!restaurant)
            return null;
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1);
        return vendor ? { lat: vendor.pickupLat, lng: vendor.pickupLng } : null;
    }
    async triggerAssignment(type, orderId) {
        const point = await this.pickupPoint(type, orderId);
        if (!point) {
            await this.markDeliveryFailed(type, orderId);
            return;
        }
        const partner = await this.findNearestOnlinePartner(point.lat, point.lng, []);
        if (!partner) {
            await this.markDeliveryFailed(type, orderId);
            return;
        }
        await this.createAssignment(type, orderId, partner.id, 1);
    }
    async createAssignment(type, orderId, partnerId, attemptNo) {
        const slaDeadline = new Date(Date.now() + delivery_constants_1.DELIVERY_SLA_SECONDS * 1000);
        const [assignment] = await this.db
            .insert(schema_1.deliveryAssignments)
            .values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            deliveryPartnerId: partnerId,
            outcome: 'pending',
            attemptNo,
            slaDeadline,
        })
            .returning();
        this.jobQueue.schedule(assignment.id, delivery_constants_1.DELIVERY_SLA_SECONDS * 1000, () => this.handleTimeout(assignment.id));
        const [partner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, partnerId)).limit(1);
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (partner && order) {
            this.notifications.notifyPush(partner.userId, 'assignment_offered', (0, ready_for_pickup_1.assignmentOfferedPartnerPush)(this.orderCode(orderId), order.deliveryFee));
        }
        return assignment;
    }
    async handleTimeout(assignmentId) {
        const [assignment] = await this.db.select().from(schema_1.deliveryAssignments).where((0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.id, assignmentId)).limit(1);
        if (!assignment || assignment.outcome !== 'pending')
            return;
        this.logger.log(`Delivery assignment ${assignmentId} timed out (partner ${assignment.deliveryPartnerId})`);
        await this.db.update(schema_1.deliveryAssignments).set({ outcome: 'timeout' }).where((0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.id, assignmentId));
        await this.reassign(assignment);
    }
    async reassign(previous) {
        const type = previous.groceryOrderId ? 'grocery' : 'food';
        const orderId = (previous.groceryOrderId ?? previous.foodOrderId);
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order || order.status === 'cancelled' || order.status === 'failed')
            return;
        if (previous.attemptNo >= delivery_constants_1.MAX_DELIVERY_ASSIGNMENT_ATTEMPTS) {
            await this.markDeliveryFailed(type, orderId);
            return;
        }
        const previousAttempts = await this.db
            .select()
            .from(schema_1.deliveryAssignments)
            .where(type === 'grocery' ? (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.groceryOrderId, orderId) : (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.foodOrderId, orderId));
        const excludeIds = previousAttempts.map((a) => a.deliveryPartnerId);
        const point = await this.pickupPoint(type, orderId);
        if (!point) {
            await this.markDeliveryFailed(type, orderId);
            return;
        }
        const partner = await this.findNearestOnlinePartner(point.lat, point.lng, excludeIds);
        if (!partner) {
            await this.markDeliveryFailed(type, orderId);
            return;
        }
        await this.createAssignment(type, orderId, partner.id, previous.attemptNo + 1);
    }
    async markDeliveryFailed(type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [updated] = await this.db.update(table).set({ status: 'failed' }).where((0, drizzle_orm_1.eq)(table.id, orderId)).returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'failed',
            actorRole: 'system',
        });
        await this.payments.markRefundPendingIfPaid(type, orderId);
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(updated.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(orderCode));
        const vendorUserId = await this.vendorUserIdForOrder(type, orderId);
        if (vendorUserId)
            this.notifications.notifyPush(vendorUserId, 'order_cancelled', (0, order_cancelled_1.orderCancelledVendorPush)(orderCode));
    }
    async requirePendingAssignment(type, orderId, partnerId) {
        const [assignment] = await this.db
            .select()
            .from(schema_1.deliveryAssignments)
            .where((0, drizzle_orm_1.and)(type === 'grocery' ? (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.groceryOrderId, orderId) : (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.foodOrderId, orderId), (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.deliveryPartnerId, partnerId), (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.outcome, 'pending')))
            .limit(1);
        if (!assignment)
            throw new common_1.NotFoundException('No pending assignment for this order and partner');
        return assignment;
    }
    async getOrderDetailForPartner(userId, type, orderId) {
        const partner = await this.requirePartner(userId);
        if (type === 'grocery') {
            const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId)).limit(1);
            if (!order)
                throw new common_1.NotFoundException('Order not found');
            const items = await this.db.select().from(schema_1.groceryOrderItems).where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.groceryOrderId, orderId));
            const [vendor] = order.vendorId
                ? await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, order.vendorId)).limit(1)
                : [];
            const [vendorUser] = vendor ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, vendor.userId)).limit(1) : [];
            const [address] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, order.deliveryAddressId)).limit(1);
            const [customer] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, order.customerId)).limit(1);
            return this.assembleAssignmentView(order, type, items.length, vendor, vendorUser, address, customer, partner.id);
        }
        const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const items = await this.db.select().from(schema_1.foodOrderItems).where((0, drizzle_orm_1.eq)(schema_1.foodOrderItems.foodOrderId, orderId));
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
        const [vendor] = restaurant
            ? await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1)
            : [];
        const [vendorUser] = vendor ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, vendor.userId)).limit(1) : [];
        const [address] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, order.deliveryAddressId)).limit(1);
        const [customer] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, order.customerId)).limit(1);
        return this.assembleAssignmentView(order, type, items.length, vendor, vendorUser, address, customer, partner.id, restaurant?.name);
    }
    assembleAssignmentView(order, type, itemCount, vendor, vendorUser, address, customer, requestingPartnerId, restaurantName) {
        if (order.deliveryPartnerId && order.deliveryPartnerId !== requestingPartnerId) {
            throw new common_1.ForbiddenException('Not your delivery');
        }
        return {
            id: order.id,
            type,
            status: order.status,
            orderCode: order.id.slice(0, 8).toUpperCase(),
            itemCount,
            deliveryFee: order.deliveryFee,
            pickupName: restaurantName ?? vendor?.businessName ?? 'Pickup point',
            pickupPhone: vendorUser?.phone ?? '',
            pickupLat: vendor?.pickupLat ?? null,
            pickupLng: vendor?.pickupLng ?? null,
            dropoffCustomer: customer?.phone ?? 'Customer',
            dropoffPhone: customer?.phone ?? '',
            dropoffAddress: address?.formattedAddress ?? '',
            dropoffLat: address?.lat ?? null,
            dropoffLng: address?.lng ?? null,
        };
    }
    async listIncoming(userId) {
        const partner = await this.requirePartner(userId);
        const rows = await this.db
            .select()
            .from(schema_1.deliveryAssignments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.deliveryPartnerId, partner.id), (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.outcome, 'pending')));
        return rows;
    }
    async listActive(userId) {
        const partner = await this.requirePartner(userId);
        const grocery = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.deliveryPartnerId, partner.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivery_assigned'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'picked_up'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'out_for_delivery'))));
        const food = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.deliveryPartnerId, partner.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivery_assigned'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'picked_up'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'out_for_delivery'))));
        return { grocery, food };
    }
    async accept(userId, type, orderId) {
        const partner = await this.requirePartner(userId);
        const assignment = await this.requirePendingAssignment(type, orderId, partner.id);
        this.jobQueue.cancel(assignment.id);
        await this.db.update(schema_1.deliveryAssignments).set({ outcome: 'accepted' }).where((0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.id, assignment.id));
        const otp = String((0, crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [updated] = await this.db
            .update(table)
            .set({ status: 'delivery_assigned', deliveryPartnerId: partner.id, deliveryOtp: otp })
            .where((0, drizzle_orm_1.eq)(table.id, orderId))
            .returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'delivery_assigned',
            actorRole: 'delivery_partner',
            changedBy: userId,
        });
        this.notifications.notifyPush(updated.customerId, 'delivery_assigned', (0, delivery_assigned_1.deliveryAssignedCustomerPush)(this.orderCode(orderId)));
        return { ok: true };
    }
    async reject(userId, type, orderId) {
        const partner = await this.requirePartner(userId);
        const assignment = await this.requirePendingAssignment(type, orderId, partner.id);
        this.jobQueue.cancel(assignment.id);
        await this.db.update(schema_1.deliveryAssignments).set({ outcome: 'rejected' }).where((0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.id, assignment.id));
        await this.reassign(assignment);
        return { ok: true };
    }
    async requireOwnActiveOrder(type, orderId, partnerId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.deliveryPartnerId !== partnerId)
            throw new common_1.ForbiddenException('Not your delivery');
        return order;
    }
    async advance(userId, type, orderId, status) {
        const partner = await this.requirePartner(userId);
        const order = await this.requireOwnActiveOrder(type, orderId, partner.id);
        const currentIndex = DELIVERY_SEQUENCE.indexOf(order.status);
        const requestedIndex = DELIVERY_SEQUENCE.indexOf(status);
        if (currentIndex === -1 || requestedIndex !== currentIndex + 1) {
            throw new common_1.BadRequestException(`Cannot move from "${order.status}" to "${status}" — status must advance one step at a time`);
        }
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        await this.db.update(table).set({ status }).where((0, drizzle_orm_1.eq)(table.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status,
            actorRole: 'delivery_partner',
            changedBy: userId,
        });
        const orderCode = this.orderCode(orderId);
        if (status === 'picked_up') {
            this.notifications.notifyPush(order.customerId, 'picked_up', (0, picked_up_1.pickedUpCustomerPush)(orderCode));
            const vendorUserId = await this.vendorUserIdForOrder(type, orderId);
            if (vendorUserId)
                this.notifications.notifyPush(vendorUserId, 'picked_up', (0, picked_up_1.pickedUpVendorPush)(orderCode));
        }
        else {
            this.notifications.notifyPush(order.customerId, 'out_for_delivery', (0, out_for_delivery_1.outForDeliveryCustomerPush)(orderCode));
        }
        return { ok: true };
    }
    async verifyDelivery(userId, type, orderId, otp) {
        const partner = await this.requirePartner(userId);
        const order = await this.requireOwnActiveOrder(type, orderId, partner.id);
        if (order.status !== 'out_for_delivery') {
            throw new common_1.BadRequestException('Order must be out for delivery before it can be marked delivered');
        }
        if (!order.deliveryOtp || order.deliveryOtp !== otp) {
            throw new common_1.BadRequestException('Incorrect OTP');
        }
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        await this.db.update(table).set({ status: 'delivered' }).where((0, drizzle_orm_1.eq)(table.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'delivered',
            actorRole: 'delivery_partner',
            changedBy: userId,
        });
        await this.payments.markCodCollected(type, orderId);
        const settlement = await this.settlements.generateForDeliveredOrder(type, orderId);
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(order.customerId, 'delivered', (0, delivered_1.deliveredCustomerPush)(orderCode));
        const vendorUserId = await this.vendorUserIdForOrder(type, orderId);
        if (vendorUserId) {
            this.notifications.notifyPush(vendorUserId, 'delivered', (0, delivered_1.deliveredVendorPush)(orderCode));
            if (settlement) {
                this.notifications.notifyEmail(vendorUserId, 'settlement_summary', (0, settlement_summary_1.settlementSummaryEmail)(`Order ${orderCode}`, order.subtotal, settlement.platformShare, settlement.vendorPayout));
            }
        }
        this.notifications.notifyPush(userId, 'delivered', (0, delivered_1.deliveredPartnerPush)(orderCode, order.deliveryFee));
        return { ok: true };
    }
    async listPartnersAdmin() {
        const rows = await this.db.select().from(schema_1.deliveryPartners);
        const userIds = rows.map((r) => r.userId);
        const userRows = userIds.length ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds)) : [];
        const userMap = new Map(userRows.map((u) => [u.id, u]));
        return rows.map((r) => {
            const u = userMap.get(r.userId);
            return {
                id: r.id,
                userId: r.userId,
                name: `Rider +91 ${u?.phone ?? '••••'}`,
                phone: u?.phone ?? '',
                email: u?.email ?? '',
                vehicleType: r.vehicleType,
                kycStatus: r.kycStatus,
                online: r.isOnline,
                activity: u?.status === 'active' ? 'active' : 'inactive',
                zone: 'Main City / Rural Hub',
                todayEarnings: 450,
                totalDeliveries: 28,
                createdAt: r.createdAt,
            };
        });
    }
    async getAdminPartner(id) {
        const [partner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, id)).limit(1);
        if (!partner)
            throw new common_1.NotFoundException('Delivery partner not found');
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, partner.userId)).limit(1);
        const docs = await this.db.select().from(schema_1.kycDocuments).where((0, drizzle_orm_1.eq)(schema_1.kycDocuments.userId, partner.userId));
        return {
            id: partner.id,
            userId: partner.userId,
            name: `Rider +91 ${user?.phone ?? '••••'}`,
            phone: user?.phone ?? '',
            email: user?.email ?? '',
            vehicleType: partner.vehicleType,
            kycStatus: partner.kycStatus,
            online: partner.isOnline,
            activity: user?.status === 'active' ? 'active' : 'inactive',
            zone: 'Main City / Rural Hub',
            kycDocuments: docs,
            todayEarnings: 450,
            totalDeliveries: 28,
            createdAt: partner.createdAt,
        };
    }
    async createAdminPartner(dto) {
        const phone = dto.phone.trim();
        const email = dto.email && dto.email.trim() ? dto.email.trim().toLowerCase() : null;
        let [user] = await this.db
            .select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.phone, phone), (0, drizzle_orm_1.eq)(schema_1.users.role, 'delivery_partner')))
            .limit(1);
        if (!user) {
            [user] = await this.db
                .insert(schema_1.users)
                .values({
                phone,
                email,
                role: 'delivery_partner',
                status: 'active',
            })
                .returning();
        }
        else {
            if (email && !user.email) {
                await this.db.update(schema_1.users).set({ email }).where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id));
            }
            const [existingPartner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.userId, user.id)).limit(1);
            if (existingPartner) {
                throw new common_1.BadRequestException(`A delivery partner profile already exists for phone ${phone}`);
            }
        }
        const kycStat = (dto.kycStatus === 'verified' || dto.kycStatus === 'rejected') ? dto.kycStatus : 'pending';
        const [partner] = await this.db
            .insert(schema_1.deliveryPartners)
            .values({
            userId: user.id,
            vehicleType: dto.vehicleType,
            kycStatus: kycStat,
            isOnline: true,
            currentLat: 16.705,
            currentLng: 74.2433,
        })
            .returning();
        if (email) {
            try {
                this.notifications.sendWelcomePartnerEmail({
                    id: user.id,
                    name: dto.name || `Rider +91 ${dto.phone}`,
                    email,
                    phone: dto.phone,
                    vehicleType: dto.vehicleType,
                });
            }
            catch (err) {
                console.error('[DeliveryService] Failed to queue welcome partner email:', err);
            }
        }
        return { ...partner, name: dto.name, phone: dto.phone, email };
    }
    async updateAdminPartner(id, dto) {
        const [p] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, id)).limit(1);
        if (!p)
            throw new common_1.NotFoundException('Delivery partner not found');
        const updateFields = {};
        if (dto.vehicleType !== undefined)
            updateFields.vehicleType = dto.vehicleType;
        if (dto.kycStatus !== undefined && dto.kycStatus !== 'unverified')
            updateFields.kycStatus = dto.kycStatus;
        if (dto.isAvailable !== undefined)
            updateFields.isOnline = dto.isAvailable;
        const [updated] = await this.db.update(schema_1.deliveryPartners).set(updateFields).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, id)).returning();
        if (dto.phone || dto.email || dto.status) {
            await this.db
                .update(schema_1.users)
                .set({
                phone: dto.phone || undefined,
                email: dto.email || undefined,
                status: dto.status || undefined,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, p.userId));
        }
        return updated;
    }
    async deleteAdminPartner(id) {
        const [p] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, id)).limit(1);
        if (!p)
            throw new common_1.NotFoundException('Delivery partner not found');
        await this.db.delete(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, id));
        return { success: true, message: `Delivery partner ${id} deleted successfully.` };
    }
    async listPartnersBasic() {
        return this.listPartnersAdmin();
    }
};
exports.DeliveryService = DeliveryService;
exports.DeliveryService = DeliveryService = DeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, job_queue_service_1.JobQueueService,
        payment_service_1.PaymentService,
        notification_service_1.NotificationService,
        settlement_service_1.SettlementService])
], DeliveryService);
//# sourceMappingURL=delivery.service.js.map