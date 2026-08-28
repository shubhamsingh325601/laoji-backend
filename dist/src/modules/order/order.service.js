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
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const allocation_service_1 = require("../allocation/allocation.service");
const catalog_service_1 = require("../catalog/catalog.service");
const delivery_service_1 = require("../delivery/delivery.service");
const payment_service_1 = require("../payment/payment.service");
const notification_service_1 = require("../notification/notification.service");
const order_placed_1 = require("../notification/templates/push/order-placed");
const order_confirmed_1 = require("../notification/templates/push/order-confirmed");
const order_cancelled_1 = require("../notification/templates/push/order-cancelled");
const revenue_config_service_1 = require("../revenue/revenue-config.service");
const catalog_types_1 = require("../catalog/catalog.types");
const STATUS_SEQUENCE = ['vendor_accepted', 'preparing', 'ready', 'handed_over'];
let OrderService = class OrderService {
    db;
    allocation;
    catalog;
    delivery;
    payments;
    notifications;
    revenueConfig;
    constructor(db, allocation, catalog, delivery, payments, notifications, revenueConfig) {
        this.db = db;
        this.allocation = allocation;
        this.catalog = catalog;
        this.delivery = delivery;
        this.payments = payments;
        this.notifications = notifications;
        this.revenueConfig = revenueConfig;
    }
    orderCode(orderId) {
        return orderId.slice(0, 8).toUpperCase();
    }
    async createGroceryOrder(customerId, dto) {
        const [address] = await this.db
            .select()
            .from(schema_1.addresses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.addresses.id, dto.deliveryAddressId), (0, drizzle_orm_1.eq)(schema_1.addresses.userId, customerId)))
            .limit(1);
        if (!address)
            throw new common_1.BadRequestException('Delivery address not found');
        const candidate = await this.allocation.findBestVendor(dto.items, address.lat, address.lng);
        if (!candidate) {
            throw new common_1.BadRequestException('No vendor can currently fulfill this cart within your delivery area — try adjusting your cart or address');
        }
        const subtotal = dto.items.reduce((sum, line) => sum + (candidate.unitPrices.get(line.productId) ?? 0) * line.qty, 0);
        const [firstProduct] = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, dto.items[0].productId)).limit(1);
        const revenue = await this.revenueConfig.resolve(candidate.vendorId, firstProduct?.categoryId ?? null);
        const deliveryFee = revenue.deliveryFeeFlat;
        const commissionPct = revenue.commissionPct;
        const total = subtotal + deliveryFee;
        const [order] = await this.db
            .insert(schema_1.groceryOrders)
            .values({
            customerId,
            status: 'placed',
            subtotal,
            deliveryFee,
            platformCommission: subtotal * commissionPct,
            commissionPct,
            total,
            instructions: dto.instructions ?? null,
            vendorId: candidate.vendorId,
            deliveryAddressId: dto.deliveryAddressId,
        })
            .returning();
        await this.db.insert(schema_1.groceryOrderItems).values(dto.items.map((line) => ({
            groceryOrderId: order.id,
            productId: line.productId,
            qty: line.qty,
            unitPrice: candidate.unitPrices.get(line.productId) ?? 0,
        })));
        await this.db.insert(schema_1.orderStatusHistory).values({
            groceryOrderId: order.id,
            status: 'placed',
            actorRole: 'customer',
            changedBy: customerId,
        });
        await this.allocation.createAttempt(order.id, candidate.vendorId, 1);
        this.notifications.notifyPush(customerId, 'order_placed', (0, order_placed_1.orderPlacedCustomerPush)(this.orderCode(order.id), total));
        const [vendorRow] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, candidate.vendorId)).limit(1);
        if (vendorRow) {
            this.notifications.notifyPush(vendorRow.userId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(this.orderCode(order.id), dto.items.length));
        }
        return this.getGroceryOrder(order.id, { userId: customerId, role: 'customer' });
    }
    async createFoodOrder(customerId, dto) {
        const [address] = await this.db
            .select()
            .from(schema_1.addresses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.addresses.id, dto.deliveryAddressId), (0, drizzle_orm_1.eq)(schema_1.addresses.userId, customerId)))
            .limit(1);
        if (!address)
            throw new common_1.BadRequestException('Delivery address not found');
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, dto.restaurantId)).limit(1);
        if (!restaurant)
            throw new common_1.BadRequestException('Restaurant not available');
        const [restaurantVendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1);
        if (!restaurant.isOpen || !restaurantVendor || !(0, catalog_types_1.isVendorOpenNow)(restaurantVendor)) {
            throw new common_1.BadRequestException('Restaurant not available');
        }
        const menuItemIds = dto.items.map((i) => i.menuItemId);
        const items = await this.db.select().from(schema_1.menuItems).where((0, drizzle_orm_1.inArray)(schema_1.menuItems.id, menuItemIds));
        const catIds = [...new Set(items.map((i) => i.menuCategoryId))];
        const cats = catIds.length
            ? await this.db.select().from(schema_1.menuCategories).where((0, drizzle_orm_1.inArray)(schema_1.menuCategories.id, catIds))
            : [];
        const catByI = new Map(cats.map((c) => [c.id, c]));
        if (items.length !== menuItemIds.length) {
            throw new common_1.BadRequestException('One or more menu items not found');
        }
        const foreignItem = items.find((item) => catByI.get(item.menuCategoryId)?.restaurantId !== dto.restaurantId);
        if (foreignItem) {
            throw new common_1.BadRequestException(`Menu item "${foreignItem.name}" does not belong to this restaurant — an order can only contain items from one restaurant`);
        }
        const itemById = new Map(items.map((i) => [i.id, i]));
        const variantIds = dto.items.map((i) => i.variantId).filter((id) => !!id);
        const addonIds = dto.items.flatMap((i) => i.addonIds ?? []);
        const variantRows = variantIds.length
            ? await this.db.select().from(schema_1.menuItemVariants).where((0, drizzle_orm_1.inArray)(schema_1.menuItemVariants.id, variantIds))
            : [];
        const addonRows = addonIds.length
            ? await this.db.select().from(schema_1.menuItemAddons).where((0, drizzle_orm_1.inArray)(schema_1.menuItemAddons.id, addonIds))
            : [];
        const variantById = new Map(variantRows.map((v) => [v.id, v]));
        const addonById = new Map(addonRows.map((a) => [a.id, a]));
        let subtotal = 0;
        const orderItemRows = dto.items.map((line) => {
            const item = itemById.get(line.menuItemId);
            const variant = line.variantId ? variantById.get(line.variantId) : undefined;
            const selectedAddons = (line.addonIds ?? []).map((id) => addonById.get(id)).filter((a) => !!a);
            const unitPrice = item.price + (variant?.priceDelta ?? 0) + selectedAddons.reduce((s, a) => s + a.price, 0);
            subtotal += unitPrice * line.qty;
            return {
                menuItemId: line.menuItemId,
                qty: line.qty,
                unitPrice,
                addonsJson: {
                    variant: variant ? { id: variant.id, name: variant.name, priceDelta: variant.priceDelta } : null,
                    addons: selectedAddons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
                },
            };
        });
        const revenue = await this.revenueConfig.resolve(restaurant.vendorId, null);
        const deliveryFee = revenue.deliveryFeeFlat;
        const commissionPct = revenue.commissionPct;
        const total = subtotal + deliveryFee;
        const [order] = await this.db
            .insert(schema_1.foodOrders)
            .values({
            customerId,
            status: 'placed',
            subtotal,
            deliveryFee,
            platformCommission: subtotal * commissionPct,
            commissionPct,
            total,
            instructions: dto.instructions ?? null,
            restaurantId: dto.restaurantId,
            deliveryAddressId: dto.deliveryAddressId,
        })
            .returning();
        await this.db.insert(schema_1.foodOrderItems).values(orderItemRows.map((r) => ({ ...r, foodOrderId: order.id })));
        await this.db.insert(schema_1.orderStatusHistory).values({
            foodOrderId: order.id,
            status: 'placed',
            actorRole: 'customer',
            changedBy: customerId,
        });
        this.notifications.notifyPush(customerId, 'order_placed', (0, order_placed_1.orderPlacedCustomerPush)(this.orderCode(order.id), total));
        const [vendorRow] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1);
        if (vendorRow) {
            this.notifications.notifyPush(vendorRow.userId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(this.orderCode(order.id), dto.items.length));
        }
        return this.getFoodOrder(order.id, { userId: customerId, role: 'customer' });
    }
    async listMyGroceryOrders(customerId) {
        return this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, customerId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt));
    }
    async listMyFoodOrders(customerId) {
        return this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, customerId)).orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt));
    }
    async getGroceryOrder(id, requester) {
        const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, id)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        await this.assertOrderAccess(order.customerId, order.vendorId, requester);
        const items = await this.db.select().from(schema_1.groceryOrderItems).where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.groceryOrderId, id));
        const history = await this.db
            .select()
            .from(schema_1.orderStatusHistory)
            .where((0, drizzle_orm_1.eq)(schema_1.orderStatusHistory.groceryOrderId, id))
            .orderBy(schema_1.orderStatusHistory.changedAt);
        const customer = await this.customerSummary(order.customerId, order.deliveryAddressId);
        return this.withOtpVisibility({ ...order, items, history: await this.enrichHistory(history), customer }, requester);
    }
    async getFoodOrder(id, requester) {
        const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, id)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
        await this.assertOrderAccess(order.customerId, restaurant?.vendorId, requester);
        const items = await this.db.select().from(schema_1.foodOrderItems).where((0, drizzle_orm_1.eq)(schema_1.foodOrderItems.foodOrderId, id));
        const history = await this.db
            .select()
            .from(schema_1.orderStatusHistory)
            .where((0, drizzle_orm_1.eq)(schema_1.orderStatusHistory.foodOrderId, id))
            .orderBy(schema_1.orderStatusHistory.changedAt);
        const customer = await this.customerSummary(order.customerId, order.deliveryAddressId);
        const [rating] = await this.db.select().from(schema_1.foodOrderRatings).where((0, drizzle_orm_1.eq)(schema_1.foodOrderRatings.foodOrderId, id)).limit(1);
        return this.withOtpVisibility({ ...order, items, history: await this.enrichHistory(history), customer, myRating: rating ?? null }, requester);
    }
    async rateFoodOrder(customerId, foodOrderId, dto) {
        const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, foodOrderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.customerId !== customerId)
            throw new common_1.ForbiddenException('Not your order');
        if (order.status !== 'delivered')
            throw new common_1.BadRequestException('Order has not been delivered yet');
        const [existing] = await this.db.select().from(schema_1.foodOrderRatings).where((0, drizzle_orm_1.eq)(schema_1.foodOrderRatings.foodOrderId, foodOrderId)).limit(1);
        if (existing)
            throw new common_1.BadRequestException('Order already rated');
        const [row] = await this.db
            .insert(schema_1.foodOrderRatings)
            .values({
            foodOrderId,
            customerId,
            restaurantId: order.restaurantId,
            rating: dto.rating,
            comment: dto.comment,
        })
            .returning();
        await this.catalog.recalcRestaurantRating(order.restaurantId);
        return row;
    }
    withOtpVisibility(order, requester) {
        if (requester.role === 'customer')
            return order;
        return { ...order, deliveryOtp: null };
    }
    async enrichHistory(history) {
        const userIds = [...new Set(history.map((h) => h.changedBy).filter((id) => !!id))];
        const userRows = userIds.length ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds)) : [];
        const userById = new Map(userRows.map((u) => [u.id, u]));
        const vendorUserIds = userRows.filter((u) => u.role === 'vendor').map((u) => u.id);
        const vendorRows = vendorUserIds.length
            ? await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.inArray)(schema_1.vendors.userId, vendorUserIds))
            : [];
        const vendorByUserId = new Map(vendorRows.map((v) => [v.userId, v]));
        return history.map((h) => {
            let actorName = 'Automated';
            if (h.changedBy) {
                const user = userById.get(h.changedBy);
                actorName =
                    h.actorRole === 'vendor'
                        ? (vendorByUserId.get(h.changedBy)?.businessName ?? user?.phone ?? 'Vendor')
                        : (user?.phone ?? user?.email ?? 'User');
            }
            return { ...h, actorName };
        });
    }
    async customerSummary(customerId, deliveryAddressId) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, customerId)).limit(1);
        const [address] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, deliveryAddressId)).limit(1);
        return {
            name: user?.phone ?? 'Customer',
            phone: user?.phone ?? '',
            line1: address?.formattedAddress ?? '',
            area: '',
            city: '',
        };
    }
    async assertOrderAccess(customerId, orderVendorId, requester) {
        if (requester.role === 'admin')
            return;
        if (requester.role === 'customer' && requester.userId === customerId)
            return;
        if (requester.role === 'vendor') {
            const vendor = await this.catalog.getVendorByUserId(requester.userId);
            if (vendor && orderVendorId === vendor.id)
                return;
        }
        throw new common_1.ForbiddenException('Not your order');
    }
    async attachGroceryItems(orders) {
        if (orders.length === 0)
            return orders.map((o) => ({ ...o, items: [] }));
        const ids = orders.map((o) => o.id);
        const items = await this.db.select().from(schema_1.groceryOrderItems).where((0, drizzle_orm_1.inArray)(schema_1.groceryOrderItems.groceryOrderId, ids));
        return orders.map((o) => ({ ...o, items: items.filter((i) => i.groceryOrderId === o.id) }));
    }
    async attachFoodItems(orders) {
        if (orders.length === 0)
            return orders.map((o) => ({ ...o, items: [] }));
        const ids = orders.map((o) => o.id);
        const items = await this.db.select().from(schema_1.foodOrderItems).where((0, drizzle_orm_1.inArray)(schema_1.foodOrderItems.foodOrderId, ids));
        return orders.map((o) => ({ ...o, items: items.filter((i) => i.foodOrderId === o.id) }));
    }
    async listVendorIncomingGroceryOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const rows = await this.db
            .select({ attempt: schema_1.allocationAttempts, order: schema_1.groceryOrders })
            .from(schema_1.allocationAttempts)
            .innerJoin(schema_1.groceryOrders, (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, schema_1.groceryOrders.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.vendorId, vendor.id), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.outcome, 'pending')));
        const orders = rows.map((r) => ({ ...r.order, slaDeadline: r.attempt.slaDeadline, attemptId: r.attempt.id }));
        return this.attachGroceryItems(orders);
    }
    async listVendorHistoryGroceryOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const orders = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendor.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'delivered'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'failed'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'cancelled'))))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt))
            .limit(100);
        return this.attachGroceryItems(orders);
    }
    async listVendorHistoryFoodOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const restaurant = await this.catalog.getOrCreateRestaurant(vendor.id);
        const orders = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'delivered'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'failed'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'cancelled'))))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt))
            .limit(100);
        return this.attachFoodItems(orders);
    }
    async listVendorActiveGroceryOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const orders = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendor.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'vendor_accepted'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'preparing'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'ready'), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'handed_over'))))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt));
        return this.attachGroceryItems(orders);
    }
    async acceptGroceryOrder(userId, orderId) {
        const vendor = await this.catalog.requireVendor(userId);
        const attempt = await this.requirePendingAttempt(orderId, vendor.id);
        await this.requirePaymentSatisfied('grocery', orderId);
        await this.allocation.handleAcceptance(attempt.id);
        const [updated] = await this.db
            .update(schema_1.groceryOrders)
            .set({ status: 'vendor_accepted' })
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId))
            .returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            groceryOrderId: orderId,
            status: 'vendor_accepted',
            actorRole: 'vendor',
            changedBy: userId,
        });
        this.notifications.notifyPush(updated.customerId, 'order_confirmed', (0, order_confirmed_1.orderConfirmedCustomerPush)(this.orderCode(orderId)));
        return this.getGroceryOrder(orderId, { userId, role: 'vendor' });
    }
    async rejectGroceryOrder(userId, orderId) {
        const vendor = await this.catalog.requireVendor(userId);
        const attempt = await this.requirePendingAttempt(orderId, vendor.id);
        await this.allocation.handleRejection(attempt.id);
        return { ok: true };
    }
    async requirePendingAttempt(groceryOrderId, vendorId) {
        const [attempt] = await this.db
            .select()
            .from(schema_1.allocationAttempts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, groceryOrderId), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.vendorId, vendorId), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.outcome, 'pending')))
            .limit(1);
        if (!attempt)
            throw new common_1.NotFoundException('No pending allocation for this order and vendor');
        return attempt;
    }
    async requirePaymentSatisfied(type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order || !this.payments.isSatisfied(order.paymentStatus)) {
            throw new common_1.BadRequestException('Payment has not been confirmed for this order yet');
        }
    }
    async advanceGroceryOrder(userId, orderId, dto) {
        const vendor = await this.catalog.requireVendor(userId);
        const order = await this.requireOwnGroceryOrder(orderId, vendor.id);
        this.assertForwardTransition(order.status, dto.status);
        await this.db.update(schema_1.groceryOrders).set({ status: dto.status }).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            groceryOrderId: orderId,
            status: dto.status,
            actorRole: 'vendor',
            changedBy: userId,
        });
        if (dto.status === 'handed_over') {
            await this.delivery.triggerAssignment('grocery', orderId);
        }
        return this.getGroceryOrder(orderId, { userId, role: 'vendor' });
    }
    async correctGroceryOrderStatus(userId, orderId, dto) {
        const vendor = await this.catalog.requireVendor(userId);
        const order = await this.requireOwnGroceryOrder(orderId, vendor.id);
        this.assertCorrection(order.status, dto.status);
        await this.db.update(schema_1.groceryOrders).set({ status: dto.status }).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            groceryOrderId: orderId,
            status: dto.status,
            actorRole: 'vendor',
            changedBy: userId,
        });
        return this.getGroceryOrder(orderId, { userId, role: 'vendor' });
    }
    async requireOwnGroceryOrder(orderId, vendorId) {
        const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.vendorId !== vendorId)
            throw new common_1.ForbiddenException('Not your order');
        return order;
    }
    async listVendorIncomingFoodOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const restaurant = await this.catalog.getOrCreateRestaurant(vendor.id);
        const orders = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'placed')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt));
        return this.attachFoodItems(orders);
    }
    async listVendorActiveFoodOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const restaurant = await this.catalog.getOrCreateRestaurant(vendor.id);
        const orders = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'vendor_accepted'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'preparing'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'ready'), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'handed_over'))))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt));
        return this.attachFoodItems(orders);
    }
    async requireOwnFoodOrder(orderId, vendorId) {
        const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
        if (!restaurant || restaurant.vendorId !== vendorId)
            throw new common_1.ForbiddenException('Not your order');
        return order;
    }
    async acceptFoodOrder(userId, orderId) {
        const vendor = await this.catalog.requireVendor(userId);
        const order = await this.requireOwnFoodOrder(orderId, vendor.id);
        if (order.status !== 'placed')
            throw new common_1.BadRequestException('Order already responded to');
        await this.requirePaymentSatisfied('food', orderId);
        await this.db.update(schema_1.foodOrders).set({ status: 'vendor_accepted' }).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            foodOrderId: orderId,
            status: 'vendor_accepted',
            actorRole: 'vendor',
            changedBy: userId,
        });
        this.notifications.notifyPush(order.customerId, 'order_confirmed', (0, order_confirmed_1.orderConfirmedCustomerPush)(this.orderCode(orderId)));
        return this.getFoodOrder(orderId, { userId, role: 'vendor' });
    }
    async rejectFoodOrder(userId, orderId) {
        const vendor = await this.catalog.requireVendor(userId);
        const order = await this.requireOwnFoodOrder(orderId, vendor.id);
        if (order.status !== 'placed')
            throw new common_1.BadRequestException('Order already responded to');
        await this.db.update(schema_1.foodOrders).set({ status: 'failed' }).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            foodOrderId: orderId,
            status: 'failed',
            actorRole: 'vendor',
            changedBy: userId,
        });
        await this.payments.markRefundPendingIfPaid('food', orderId);
        this.notifications.notifyPush(order.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(this.orderCode(orderId)));
        this.notifications.notifyPush(userId, 'order_cancelled', (0, order_cancelled_1.orderCancelledVendorPush)(this.orderCode(orderId)));
        return this.getFoodOrder(orderId, { userId, role: 'vendor' });
    }
    async advanceFoodOrder(userId, orderId, dto) {
        const vendor = await this.catalog.requireVendor(userId);
        const order = await this.requireOwnFoodOrder(orderId, vendor.id);
        this.assertForwardTransition(order.status, dto.status);
        await this.db.update(schema_1.foodOrders).set({ status: dto.status }).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            foodOrderId: orderId,
            status: dto.status,
            actorRole: 'vendor',
            changedBy: userId,
        });
        if (dto.status === 'handed_over') {
            await this.delivery.triggerAssignment('food', orderId);
        }
        return this.getFoodOrder(orderId, { userId, role: 'vendor' });
    }
    async correctFoodOrderStatus(userId, orderId, dto) {
        const vendor = await this.catalog.requireVendor(userId);
        const order = await this.requireOwnFoodOrder(orderId, vendor.id);
        this.assertCorrection(order.status, dto.status);
        await this.db.update(schema_1.foodOrders).set({ status: dto.status }).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId));
        await this.db.insert(schema_1.orderStatusHistory).values({
            foodOrderId: orderId,
            status: dto.status,
            actorRole: 'vendor',
            changedBy: userId,
        });
        return this.getFoodOrder(orderId, { userId, role: 'vendor' });
    }
    assertForwardTransition(currentStatus, requested) {
        const currentIndex = STATUS_SEQUENCE.indexOf(currentStatus);
        const requestedIndex = STATUS_SEQUENCE.indexOf(requested);
        if (currentIndex === -1 || requestedIndex !== currentIndex + 1) {
            throw new common_1.BadRequestException(`Cannot move from "${currentStatus}" to "${requested}" — status must advance one step at a time`);
        }
    }
    assertCorrection(currentStatus, requested) {
        const currentIndex = STATUS_SEQUENCE.indexOf(currentStatus);
        const requestedIndex = STATUS_SEQUENCE.indexOf(requested);
        if (currentIndex === -1 || requestedIndex !== currentIndex - 1) {
            throw new common_1.BadRequestException(`"${requested}" is not the step immediately before "${currentStatus}"`);
        }
    }
    async listAllOrdersForAdmin() {
        const grocery = await this.db.select().from(schema_1.groceryOrders).orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt));
        const food = await this.db.select().from(schema_1.foodOrders).orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt));
        const customerIds = [...new Set([...grocery.map((o) => o.customerId), ...food.map((o) => o.customerId)])];
        const customerRows = customerIds.length
            ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, customerIds))
            : [];
        const customerPhoneById = new Map(customerRows.map((u) => [u.id, u.phone ?? '']));
        return {
            grocery: grocery.map((o) => {
                const { deliveryOtp: _otp, ...rest } = o;
                return { ...rest, type: 'grocery', customerName: customerPhoneById.get(o.customerId) ?? '' };
            }),
            food: food.map((o) => {
                const { deliveryOtp: _otp, ...rest } = o;
                return { ...rest, type: 'food', customerName: customerPhoneById.get(o.customerId) ?? '' };
            }),
        };
    }
    async getOrderTimelineForAdmin(type, id) {
        return type === 'grocery'
            ? this.getGroceryOrder(id, { userId: '', role: 'admin' })
            : this.getFoodOrder(id, { userId: '', role: 'admin' });
    }
    async cancelOrder(adminUserId, type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (['delivered', 'failed', 'cancelled'].includes(order.status)) {
            throw new common_1.BadRequestException(`Order is already "${order.status}" — nothing to cancel`);
        }
        const [updated] = await this.db.update(table).set({ status: 'cancelled' }).where((0, drizzle_orm_1.eq)(table.id, orderId)).returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'cancelled',
            actorRole: 'admin',
            changedBy: adminUserId,
        });
        await this.payments.markRefundPendingIfPaid(type, orderId);
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(updated.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(orderCode));
        const vendorUserId = await this.vendorUserIdForOrder(type, updated);
        if (vendorUserId)
            this.notifications.notifyPush(vendorUserId, 'order_cancelled', (0, order_cancelled_1.orderCancelledVendorPush)(orderCode));
        if (updated.deliveryPartnerId) {
            const [partner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, updated.deliveryPartnerId)).limit(1);
            if (partner)
                this.notifications.notifyPush(partner.userId, 'order_cancelled', (0, order_cancelled_1.orderCancelledPartnerPush)(orderCode));
        }
        return type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
    }
    async vendorUserIdForOrder(type, order) {
        let vendorId = type === 'grocery' ? order.vendorId : undefined;
        if (type === 'food' && order.restaurantId) {
            const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
            vendorId = restaurant?.vendorId;
        }
        if (!vendorId)
            return null;
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId)).limit(1);
        return vendor?.userId ?? null;
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, allocation_service_1.AllocationService,
        catalog_service_1.CatalogService,
        delivery_service_1.DeliveryService,
        payment_service_1.PaymentService,
        notification_service_1.NotificationService,
        revenue_config_service_1.RevenueConfigService])
], OrderService);
//# sourceMappingURL=order.service.js.map