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
const picked_up_1 = require("../notification/templates/push/picked-up");
const out_for_delivery_1 = require("../notification/templates/push/out-for-delivery");
const revenue_config_service_1 = require("../revenue/revenue-config.service");
const coupon_service_1 = require("../coupon/coupon.service");
const vendor_discounts_service_1 = require("../vendor-discounts/vendor-discounts.service");
const wallet_service_1 = require("../wallet/wallet.service");
const catalog_types_1 = require("../catalog/catalog.types");
const meal_slots_1 = require("../catalog/meal-slots");
const CONFIRMED_PAYMENT_STATUSES = ['paid', 'pending_cod', 'collected', 'refund_pending', 'refunded'];
const STATUS_SEQUENCE = ['vendor_accepted', 'preparing', 'ready', 'handed_over'];
let OrderService = class OrderService {
    db;
    allocation;
    catalog;
    delivery;
    payments;
    notifications;
    revenueConfig;
    coupons;
    vendorDiscounts;
    wallet;
    constructor(db, allocation, catalog, delivery, payments, notifications, revenueConfig, coupons, vendorDiscounts, wallet) {
        this.db = db;
        this.allocation = allocation;
        this.catalog = catalog;
        this.delivery = delivery;
        this.payments = payments;
        this.notifications = notifications;
        this.revenueConfig = revenueConfig;
        this.coupons = coupons;
        this.vendorDiscounts = vendorDiscounts;
        this.wallet = wallet;
        this.payments.onPaymentSatisfied.subscribe(({ type, orderId }) => {
            this.handlePaymentSatisfied(type, orderId).catch((err) => {
                console.error('[OrderService] handlePaymentSatisfied error:', err);
            });
        });
    }
    orderCode(orderId) {
        return orderId.slice(0, 8).toUpperCase();
    }
    async priceGroceryCart(customerId, dto) {
        const [address] = await this.db
            .select()
            .from(schema_1.addresses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.addresses.id, dto.deliveryAddressId), (0, drizzle_orm_1.eq)(schema_1.addresses.userId, customerId)))
            .limit(1);
        if (!address)
            throw new common_1.BadRequestException('Delivery address not found');
        const candidate = await this.allocation.findBestVendor(dto.items, address.lat, address.lng, [], customerId);
        if (!candidate) {
            throw new common_1.BadRequestException('No vendor can currently fulfill this cart within your delivery area — try adjusting your cart or address');
        }
        const subtotal = dto.items.reduce((sum, line) => sum + (candidate.unitPrices.get(line.productId) ?? 0) * line.qty, 0);
        const [firstProduct] = await this.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, dto.items[0].productId)).limit(1);
        const revenueCategoryId = firstProduct ? await this.catalog.customerCategoryId(firstProduct.categoryId) : null;
        const revenue = await this.revenueConfig.resolve(candidate.vendorId, revenueCategoryId);
        const distanceKm = candidate.distance ?? 1;
        const pricing = await this.priceTotals(customerId, subtotal, distanceKm, revenue, dto.couponCode, candidate.vendorId, address);
        return { candidate, revenue, ...pricing };
    }
    async priceTotals(customerId, subtotal, distanceKm, revenue, couponCode, vendorId, dropoff) {
        const outerZone = (0, catalog_types_1.isOutsideCoreZone)(dropoff.lat, dropoff.lng);
        const baseFee = this.revenueConfig.calculateDeliveryFee(revenue, subtotal, distanceKm);
        const deliveryFee = outerZone && baseFee > 0 ? catalog_types_1.OUTER_ZONE_DELIVERY_FEE : baseFee;
        const ctx = { subtotal, deliveryFee, userId: customerId, vendorId, noFreeDeliveryVoucher: outerZone };
        let code = couponCode?.trim().toUpperCase() ?? '';
        let autoApplied = false;
        let coupon = code ? await this.coupons.evaluate(code, ctx) : null;
        if (couponCode === undefined && subtotal >= revenue.minOrderValue) {
            const auto = await this.coupons.findAutoApply(ctx);
            if (auto) {
                code = auto.code;
                coupon = auto.evaluation;
                autoApplied = true;
            }
        }
        const discount = coupon?.valid ? coupon.discount : 0;
        return {
            subtotal,
            distanceKm: (0, catalog_types_1.roundKm)(distanceKm),
            deliveryFee,
            discount,
            total: Math.max(0, subtotal + deliveryFee - discount),
            minOrderValue: revenue.minOrderValue,
            freeDeliveryThreshold: revenue.freeDeliveryThreshold,
            coupon: coupon
                ? { code, valid: coupon.valid, message: coupon.message, autoApplied, details: coupon.coupon ?? null }
                : null,
        };
    }
    toQuote(p) {
        const deliveryAlreadyFree = p.deliveryFee <= 0 || (!!p.coupon?.valid && p.coupon.details?.discountType === 'free_delivery');
        return {
            ...p,
            belowMinimum: p.subtotal < p.minOrderValue,
            amountToMinimum: Math.max(0, p.minOrderValue - p.subtotal),
            amountToFreeDelivery: deliveryAlreadyFree ? 0 : Math.max(0, p.freeDeliveryThreshold - p.subtotal),
        };
    }
    assertOrderable(p) {
        if (p.subtotal < p.minOrderValue) {
            throw new common_1.BadRequestException(`Minimum order is ₹${p.minOrderValue} — add ₹${p.minOrderValue - p.subtotal} more to place this order`);
        }
        if (p.coupon && !p.coupon.valid) {
            throw new common_1.BadRequestException(p.coupon.message);
        }
    }
    async quoteGroceryOrder(customerId, dto) {
        const { candidate: _candidate, revenue: _revenue, ...pricing } = await this.priceGroceryCart(customerId, dto);
        return this.toQuote(pricing);
    }
    async quoteFoodOrder(customerId, dto) {
        const { pricing } = await this.priceFoodCart(customerId, dto);
        return this.toQuote(pricing);
    }
    async createGroceryOrder(customerId, dto, actor) {
        const idempotencyKey = dto.idempotencyKey?.trim() || null;
        if (idempotencyKey) {
            const [existing] = await this.db
                .select()
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.idempotencyKey, idempotencyKey)))
                .limit(1);
            if (existing) {
                return this.getGroceryOrder(existing.id, { userId: customerId, role: 'customer' });
            }
        }
        else {
            const fiveSecondsAgo = new Date(Date.now() - 5000);
            const [recentPlaced] = await this.db
                .select()
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.deliveryAddressId, dto.deliveryAddressId), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'placed'), (0, drizzle_orm_1.gte)(schema_1.groceryOrders.createdAt, fiveSecondsAgo)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt))
                .limit(1);
            if (recentPlaced) {
                return this.getGroceryOrder(recentPlaced.id, { userId: customerId, role: 'customer' });
            }
        }
        const priced = await this.priceGroceryCart(customerId, dto);
        this.assertOrderable(priced);
        const { candidate, revenue, subtotal, deliveryFee, discount, total } = priced;
        const commissionPct = revenue.commissionPct;
        const productIds = dto.items.map((i) => i.productId);
        const vpRows = productIds.length
            ? await this.db
                .select({ productId: schema_1.vendorProducts.productId, commissionPct: schema_1.vendorProducts.commissionPct })
                .from(schema_1.vendorProducts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorProducts.vendorId, candidate.vendorId), (0, drizzle_orm_1.inArray)(schema_1.vendorProducts.productId, productIds)))
            : [];
        const vpCommMap = new Map(vpRows.map((r) => [r.productId, r.commissionPct]));
        let calculatedPlatformCommission = 0;
        for (const line of dto.items) {
            const lineSubtotal = (candidate.unitPrices.get(line.productId) ?? 0) * line.qty;
            const customComm = vpCommMap.get(line.productId);
            const effectiveRate = customComm != null
                ? (customComm > 1 ? customComm / 100 : customComm)
                : commissionPct;
            calculatedPlatformCommission += lineSubtotal * effectiveRate;
        }
        try {
            const [order] = await this.db
                .insert(schema_1.groceryOrders)
                .values({
                customerId,
                idempotencyKey,
                status: 'placed',
                subtotal,
                deliveryFee,
                platformCommission: Math.round(calculatedPlatformCommission * 100) / 100,
                commissionPct,
                couponCode: priced.coupon?.code ?? null,
                discount,
                total,
                instructions: dto.instructions ?? null,
                vendorId: candidate.vendorId,
                deliveryAddressId: dto.deliveryAddressId,
            })
                .returning();
            if (order.couponCode) {
                await this.recordPendingAffiliateCommission(order, 'grocery');
            }
            await this.db.insert(schema_1.groceryOrderItems).values(dto.items.map((line) => ({
                groceryOrderId: order.id,
                productId: line.productId,
                qty: line.qty,
                unitPrice: candidate.unitPrices.get(line.productId) ?? 0,
            })));
            await this.db.insert(schema_1.orderStatusHistory).values({
                groceryOrderId: order.id,
                status: 'placed',
                actorRole: actor?.role ?? 'customer',
                changedBy: actor?.userId ?? customerId,
            });
            const vDiscounts = await this.vendorDiscounts.getActiveDiscountsForVendor(candidate.vendorId, customerId);
            const redeemedDiscountIds = new Set();
            for (const line of dto.items) {
                const disc = this.vendorDiscounts.calculateItemDiscount(0, vDiscounts, { productId: line.productId });
                if (disc.discountApplied && !redeemedDiscountIds.has(disc.discountApplied.id)) {
                    redeemedDiscountIds.add(disc.discountApplied.id);
                    await this.vendorDiscounts.recordRedemption(disc.discountApplied.id, candidate.vendorId, customerId, order.id);
                }
            }
            return this.getGroceryOrder(order.id, { userId: customerId, role: 'customer' });
        }
        catch (err) {
            if (idempotencyKey &&
                (err?.code === '23505' ||
                    err?.message?.includes('grocery_orders_customer_idempotency_idx') ||
                    err?.message?.includes('idempotency'))) {
                const [existing] = await this.db
                    .select()
                    .from(schema_1.groceryOrders)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.idempotencyKey, idempotencyKey)))
                    .limit(1);
                if (existing) {
                    return this.getGroceryOrder(existing.id, { userId: customerId, role: 'customer' });
                }
            }
            throw err;
        }
    }
    async priceFoodCart(customerId, dto) {
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
            throw new common_1.BadRequestException('This restaurant is currently closed and not accepting new orders');
        }
        const distanceKm = (0, catalog_types_1.haversineKm)(address.lat, address.lng, restaurantVendor.pickupLat, restaurantVendor.pickupLng);
        if (distanceKm > restaurantVendor.radiusKm) {
            throw new common_1.BadRequestException(`This restaurant doesn't deliver to your address (${(0, catalog_types_1.roundKm)(distanceKm)} km away, delivers within ${restaurantVendor.radiusKm} km)`);
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
        const timings = (0, meal_slots_1.effectiveMealTimings)(restaurant.mealTimings);
        const now = new Date();
        for (const item of items) {
            if (!item.isAvailable) {
                throw new common_1.BadRequestException(`"${item.name}" is currently unavailable`);
            }
            if (!(0, meal_slots_1.isServedNow)(item.mealSlots, timings, now)) {
                throw new common_1.BadRequestException(`"${item.name}" is only served during ${(0, meal_slots_1.describeMealSlots)(item.mealSlots ?? [], timings)}`);
            }
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
        const vDiscounts = await this.vendorDiscounts.getActiveDiscountsForVendor(restaurant.vendorId, customerId);
        let subtotal = 0;
        const orderItemRows = dto.items.map((line) => {
            const item = itemById.get(line.menuItemId);
            const disc = this.vendorDiscounts.calculateItemDiscount(item.price, vDiscounts, { menuItemId: line.menuItemId });
            const variant = line.variantId ? variantById.get(line.variantId) : undefined;
            const selectedAddons = (line.addonIds ?? []).map((id) => addonById.get(id)).filter((a) => !!a);
            const unitPrice = disc.price + (variant?.priceDelta ?? 0) + selectedAddons.reduce((s, a) => s + a.price, 0);
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
        const pricing = await this.priceTotals(customerId, subtotal, distanceKm, revenue, dto.couponCode, restaurant.vendorId, address);
        return { revenue, orderItemRows, pricing };
    }
    async createFoodOrder(customerId, dto, actor) {
        const idempotencyKey = dto.idempotencyKey?.trim() || null;
        if (idempotencyKey) {
            const [existing] = await this.db
                .select()
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.foodOrders.idempotencyKey, idempotencyKey)))
                .limit(1);
            if (existing) {
                return this.getFoodOrder(existing.id, { userId: customerId, role: 'customer' });
            }
        }
        else {
            const fiveSecondsAgo = new Date(Date.now() - 5000);
            const [recentPlaced] = await this.db
                .select()
                .from(schema_1.foodOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, dto.restaurantId), (0, drizzle_orm_1.eq)(schema_1.foodOrders.deliveryAddressId, dto.deliveryAddressId), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'placed'), (0, drizzle_orm_1.gte)(schema_1.foodOrders.createdAt, fiveSecondsAgo)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt))
                .limit(1);
            if (recentPlaced) {
                return this.getFoodOrder(recentPlaced.id, { userId: customerId, role: 'customer' });
            }
        }
        const { revenue, orderItemRows, pricing } = await this.priceFoodCart(customerId, dto);
        this.assertOrderable(pricing);
        const { subtotal, deliveryFee, discount, total } = pricing;
        const commissionPct = revenue.commissionPct;
        const menuItemIds = orderItemRows.map((i) => i.menuItemId);
        const miRows = menuItemIds.length
            ? await this.db
                .select({ id: schema_1.menuItems.id, commissionPct: schema_1.menuItems.commissionPct })
                .from(schema_1.menuItems)
                .where((0, drizzle_orm_1.inArray)(schema_1.menuItems.id, menuItemIds))
            : [];
        const miCommMap = new Map(miRows.map((r) => [r.id, r.commissionPct]));
        let calculatedPlatformCommission = 0;
        for (const row of orderItemRows) {
            const lineSubtotal = row.unitPrice * row.qty;
            const customComm = miCommMap.get(row.menuItemId);
            const effectiveRate = customComm != null
                ? (customComm > 1 ? customComm / 100 : customComm)
                : commissionPct;
            calculatedPlatformCommission += lineSubtotal * effectiveRate;
        }
        try {
            const [order] = await this.db
                .insert(schema_1.foodOrders)
                .values({
                customerId,
                idempotencyKey,
                status: 'placed',
                subtotal,
                deliveryFee,
                platformCommission: Math.round(calculatedPlatformCommission * 100) / 100,
                commissionPct,
                couponCode: pricing.coupon?.code ?? null,
                discount,
                total,
                instructions: dto.instructions ?? null,
                restaurantId: dto.restaurantId,
                deliveryAddressId: dto.deliveryAddressId,
            })
                .returning();
            if (order.couponCode) {
                await this.recordPendingAffiliateCommission(order, 'food');
            }
            await this.db.insert(schema_1.foodOrderItems).values(orderItemRows.map((r) => ({ ...r, foodOrderId: order.id })));
            await this.db.insert(schema_1.orderStatusHistory).values({
                foodOrderId: order.id,
                status: 'placed',
                actorRole: actor?.role ?? 'customer',
                changedBy: actor?.userId ?? customerId,
            });
            const [rest] = await this.db.select({ vendorId: schema_1.restaurants.vendorId }).from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, dto.restaurantId)).limit(1);
            if (rest) {
                const vDiscounts = await this.vendorDiscounts.getActiveDiscountsForVendor(rest.vendorId, customerId);
                const redeemedDiscountIds = new Set();
                for (const line of dto.items) {
                    const disc = this.vendorDiscounts.calculateItemDiscount(0, vDiscounts, { menuItemId: line.menuItemId });
                    if (disc.discountApplied && !redeemedDiscountIds.has(disc.discountApplied.id)) {
                        redeemedDiscountIds.add(disc.discountApplied.id);
                        await this.vendorDiscounts.recordRedemption(disc.discountApplied.id, rest.vendorId, customerId, order.id);
                    }
                }
            }
            return this.getFoodOrder(order.id, { userId: customerId, role: 'customer' });
        }
        catch (err) {
            if (idempotencyKey &&
                (err?.code === '23505' ||
                    err?.message?.includes('food_orders_customer_idempotency_idx') ||
                    err?.message?.includes('idempotency'))) {
                const [existing] = await this.db
                    .select()
                    .from(schema_1.foodOrders)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.foodOrders.idempotencyKey, idempotencyKey)))
                    .limit(1);
                if (existing) {
                    return this.getFoodOrder(existing.id, { userId: customerId, role: 'customer' });
                }
            }
            throw err;
        }
    }
    async listMyGroceryOrders(customerId) {
        const orders = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.customerId, customerId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt));
        return this.attachGroceryItems(orders);
    }
    async listMyFoodOrders(customerId) {
        const orders = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where((0, drizzle_orm_1.eq)(schema_1.foodOrders.customerId, customerId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt));
        return this.attachFoodItems(orders);
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
        const customer = await this.customerSummary(order.customerId, order.deliveryAddressId, requester.role);
        const deliveryPartner = await this.getDeliveryPartnerSummary(order.deliveryPartnerId);
        return this.withOtpVisibility({ ...order, items, history: await this.enrichHistory(history, requester.role), customer, deliveryPartner }, requester);
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
        const customer = await this.customerSummary(order.customerId, order.deliveryAddressId, requester.role);
        const deliveryPartner = await this.getDeliveryPartnerSummary(order.deliveryPartnerId);
        const [rating] = await this.db.select().from(schema_1.foodOrderRatings).where((0, drizzle_orm_1.eq)(schema_1.foodOrderRatings.foodOrderId, id)).limit(1);
        return this.withOtpVisibility({ ...order, items, history: await this.enrichHistory(history, requester.role), customer, deliveryPartner, myRating: rating ?? null }, requester);
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
    async enrichHistory(history, requesterRole) {
        const userIds = [...new Set(history.map((h) => h.changedBy).filter((id) => !!id))];
        const userRows = userIds.length ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds)) : [];
        const userById = new Map(userRows.map((u) => [u.id, u]));
        const vendorUserIds = userRows.filter((u) => u.role === 'vendor').map((u) => u.id);
        const vendorRows = vendorUserIds.length
            ? await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.inArray)(schema_1.vendors.userId, vendorUserIds))
            : [];
        const vendorByUserId = new Map(vendorRows.map((v) => [v.userId, v]));
        const isVendor = requesterRole === 'vendor';
        return history.map((h) => {
            let actorName = 'Automated';
            if (h.changedBy) {
                const user = userById.get(h.changedBy);
                if (isVendor) {
                    if (h.actorRole === 'vendor') {
                        actorName = vendorByUserId.get(h.changedBy)?.businessName ?? 'Vendor';
                    }
                    else if (h.actorRole === 'customer') {
                        actorName = 'Customer';
                    }
                    else {
                        actorName = user?.name || 'Delivery Partner';
                    }
                }
                else {
                    actorName =
                        h.actorRole === 'vendor'
                            ? (vendorByUserId.get(h.changedBy)?.businessName ?? user?.phone ?? 'Vendor')
                            : (user?.phone ?? user?.email ?? 'User');
                }
            }
            return { ...h, actorName };
        });
    }
    async getDeliveryPartnerSummary(deliveryPartnerId) {
        if (!deliveryPartnerId)
            return null;
        const [partner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, deliveryPartnerId)).limit(1);
        if (!partner)
            return null;
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, partner.userId)).limit(1);
        return {
            id: partner.id,
            name: user?.name || 'Delivery Partner',
            phone: user?.phone || '',
            vehicleType: partner.vehicleType || 'Bike',
        };
    }
    async customerSummary(customerId, deliveryAddressId, requesterRole) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, customerId)).limit(1);
        const [address] = await this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.id, deliveryAddressId)).limit(1);
        const isVendor = requesterRole === 'vendor';
        return {
            name: isVendor ? 'Customer' : (user?.name || user?.phone || 'Customer'),
            phone: isVendor ? '' : (user?.phone ?? ''),
            line1: isVendor ? '' : (address?.formattedAddress ?? ''),
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
        const partnerIds = [...new Set(orders.map((o) => o.deliveryPartnerId).filter((id) => !!id))];
        const partnerMap = new Map();
        if (partnerIds.length > 0) {
            const partners = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.inArray)(schema_1.deliveryPartners.id, partnerIds));
            const userIds = partners.map((p) => p.userId);
            const partnerUsers = userIds.length ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds)) : [];
            const userMap = new Map(partnerUsers.map((u) => [u.id, u]));
            for (const p of partners) {
                const u = userMap.get(p.userId);
                partnerMap.set(p.id, {
                    id: p.id,
                    name: u?.name || 'Delivery Partner',
                    phone: u?.phone || '',
                    vehicleType: p.vehicleType || 'Bike',
                });
            }
        }
        return orders.map((o) => ({
            ...o,
            items: items.filter((i) => i.groceryOrderId === o.id),
            deliveryPartner: o.deliveryPartnerId ? partnerMap.get(o.deliveryPartnerId) ?? null : null,
        }));
    }
    async attachFoodItems(orders) {
        if (orders.length === 0)
            return orders.map((o) => ({ ...o, items: [] }));
        const ids = orders.map((o) => o.id);
        const items = await this.db.select().from(schema_1.foodOrderItems).where((0, drizzle_orm_1.inArray)(schema_1.foodOrderItems.foodOrderId, ids));
        const partnerIds = [...new Set(orders.map((o) => o.deliveryPartnerId).filter((id) => !!id))];
        const partnerMap = new Map();
        if (partnerIds.length > 0) {
            const partners = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.inArray)(schema_1.deliveryPartners.id, partnerIds));
            const userIds = partners.map((p) => p.userId);
            const partnerUsers = userIds.length ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, userIds)) : [];
            const userMap = new Map(partnerUsers.map((u) => [u.id, u]));
            for (const p of partners) {
                const u = userMap.get(p.userId);
                partnerMap.set(p.id, {
                    id: p.id,
                    name: u?.name || 'Delivery Partner',
                    phone: u?.phone || '',
                    vehicleType: p.vehicleType || 'Bike',
                });
            }
        }
        return orders.map((o) => ({
            ...o,
            items: items.filter((i) => i.foodOrderId === o.id),
            deliveryPartner: o.deliveryPartnerId ? partnerMap.get(o.deliveryPartnerId) ?? null : null,
        }));
    }
    async handlePaymentSatisfied(type, orderId, opts = {}) {
        if (type === 'grocery') {
            const [order] = await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId)).limit(1);
            if (!order || !order.vendorId)
                return;
            const [latestAttempt] = await this.db
                .select()
                .from(schema_1.allocationAttempts)
                .where((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, orderId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.allocationAttempts.attemptNo))
                .limit(1);
            if (!latestAttempt || opts.reopen) {
                await this.allocation.createAttempt(order.id, order.vendorId, (latestAttempt?.attemptNo ?? 0) + 1);
                const [vendorRow] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, order.vendorId)).limit(1);
                if (vendorRow && vendorRow.userId !== order.customerId) {
                    const items = await this.db.select().from(schema_1.groceryOrderItems).where((0, drizzle_orm_1.eq)(schema_1.groceryOrderItems.groceryOrderId, order.id));
                    this.notifications.notifyPush(vendorRow.userId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(this.orderCode(order.id), items.length, order.id, 'grocery'));
                }
            }
            const [customerUser] = order.customerId
                ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, order.customerId)).limit(1)
                : [null];
            this.notifications.notifyAllAdminsPush('order_placed', (0, order_placed_1.orderPlacedAdminPush)(this.orderCode(order.id), order.total, 'grocery', order.id, customerUser?.name ?? undefined));
        }
        else {
            const [order] = await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId)).limit(1);
            if (!order || !order.restaurantId)
                return;
            const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
            if (restaurant && restaurant.vendorId) {
                const [vendorRow] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, restaurant.vendorId)).limit(1);
                if (vendorRow && vendorRow.userId !== order.customerId) {
                    const items = await this.db.select().from(schema_1.foodOrderItems).where((0, drizzle_orm_1.eq)(schema_1.foodOrderItems.foodOrderId, order.id));
                    this.notifications.notifyPush(vendorRow.userId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(this.orderCode(order.id), items.length, order.id, 'food'));
                }
            }
            const [customerUser] = order.customerId
                ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, order.customerId)).limit(1)
                : [null];
            this.notifications.notifyAllAdminsPush('order_placed', (0, order_placed_1.orderPlacedAdminPush)(this.orderCode(order.id), order.total, 'food', order.id, customerUser?.name ?? undefined));
        }
    }
    async listVendorIncomingGroceryOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const rows = await this.db
            .select({ attempt: schema_1.allocationAttempts, order: schema_1.groceryOrders })
            .from(schema_1.allocationAttempts)
            .innerJoin(schema_1.groceryOrders, (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, schema_1.groceryOrders.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.vendorId, vendor.id), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.outcome, 'pending'), (0, drizzle_orm_1.inArray)(schema_1.groceryOrders.paymentStatus, ['paid', 'pending_cod', 'collected'])));
        const orders = rows.map((r) => ({ ...r.order, slaDeadline: r.attempt.slaDeadline, attemptId: r.attempt.id }));
        return this.attachGroceryItems(orders);
    }
    async listVendorHistoryGroceryOrders(userId) {
        const vendor = await this.catalog.requireVendor(userId);
        const orders = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendor.id), (0, drizzle_orm_1.inArray)(schema_1.groceryOrders.paymentStatus, CONFIRMED_PAYMENT_STATUSES)))
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
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.inArray)(schema_1.foodOrders.paymentStatus, CONFIRMED_PAYMENT_STATUSES)))
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
        this.notifications.notifyPush(updated.customerId, 'order_confirmed', (0, order_confirmed_1.orderConfirmedCustomerPush)(this.orderCode(orderId), orderId, 'grocery'));
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
        if (dto.status === 'ready' || dto.status === 'handed_over' || dto.status === 'preparing') {
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
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, restaurant.id), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'placed'), (0, drizzle_orm_1.inArray)(schema_1.foodOrders.paymentStatus, ['paid', 'pending_cod', 'collected'])))
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
        this.notifications.notifyPush(order.customerId, 'order_confirmed', (0, order_confirmed_1.orderConfirmedCustomerPush)(this.orderCode(orderId), orderId, 'food'));
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
        this.notifications.notifyPush(order.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(this.orderCode(orderId), orderId, 'food'));
        this.notifications.notifyPush(userId, 'order_cancelled', (0, order_cancelled_1.orderCancelledVendorPush)(this.orderCode(orderId), orderId));
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
        if (dto.status === 'ready' || dto.status === 'handed_over' || dto.status === 'preparing') {
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
    async listAllOrdersForAdmin(opts = {}) {
        const grocery = await this.db
            .select()
            .from(schema_1.groceryOrders)
            .where(opts.includeUnpaid
            ? undefined
            : (0, drizzle_orm_1.or)((0, drizzle_orm_1.inArray)(schema_1.groceryOrders.paymentStatus, CONFIRMED_PAYMENT_STATUSES), (0, drizzle_orm_1.eq)(schema_1.groceryOrders.status, 'cancelled')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.groceryOrders.createdAt));
        const food = await this.db
            .select()
            .from(schema_1.foodOrders)
            .where(opts.includeUnpaid
            ? undefined
            : (0, drizzle_orm_1.or)((0, drizzle_orm_1.inArray)(schema_1.foodOrders.paymentStatus, CONFIRMED_PAYMENT_STATUSES), (0, drizzle_orm_1.eq)(schema_1.foodOrders.status, 'cancelled')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.foodOrders.createdAt));
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
        await this.wallet.cancelPendingCommission(type, orderId);
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(updated.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(orderCode, orderId, type));
        const vendorKnewOrder = CONFIRMED_PAYMENT_STATUSES.includes(updated.paymentStatus);
        const vendorUserId = vendorKnewOrder ? await this.vendorUserIdForOrder(type, updated) : null;
        if (vendorUserId)
            this.notifications.notifyPush(vendorUserId, 'order_cancelled', (0, order_cancelled_1.orderCancelledVendorPush)(orderCode, orderId));
        if (updated.deliveryPartnerId) {
            const [partner] = await this.db.select().from(schema_1.deliveryPartners).where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, updated.deliveryPartnerId)).limit(1);
            if (partner)
                this.notifications.notifyPush(partner.userId, 'order_cancelled', (0, order_cancelled_1.orderCancelledPartnerPush)(orderCode, orderId));
        }
        return type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
    }
    async setOrderStatusByAdmin(adminUserId, type, orderId, status) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (['cancelled', 'failed'].includes(order.status)) {
            throw new common_1.BadRequestException(`Restore this ${order.status} order first, then set its status`);
        }
        if (order.status === 'delivered')
            throw new common_1.BadRequestException('Order is already delivered');
        if (order.status === status)
            throw new common_1.BadRequestException(`Order is already "${status}"`);
        const needsPartner = ['delivery_assigned', 'picked_up', 'out_for_delivery', 'delivered'].includes(status);
        if (needsPartner && !order.deliveryPartnerId) {
            throw new common_1.BadRequestException('Assign a delivery partner before setting this status');
        }
        const timeline = () => type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
        if (order.status === 'placed') {
            await this.acceptOrderByAdmin(adminUserId, type, orderId);
            if (status === 'vendor_accepted')
                return timeline();
        }
        if (status === 'delivered') {
            await this.delivery.adminCompleteDelivery(adminUserId, type, orderId);
            return timeline();
        }
        const [updated] = await this.db.update(table).set({ status }).where((0, drizzle_orm_1.eq)(table.id, orderId)).returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status,
            actorRole: 'admin',
            changedBy: adminUserId,
        });
        const orderCode = this.orderCode(orderId);
        if (status === 'picked_up') {
            this.notifications.notifyPush(updated.customerId, 'picked_up', (0, picked_up_1.pickedUpCustomerPush)(orderCode, orderId, type));
            const vendorUserId = await this.vendorUserIdForOrder(type, updated);
            if (vendorUserId)
                this.notifications.notifyPush(vendorUserId, 'picked_up', (0, picked_up_1.pickedUpVendorPush)(orderCode, orderId));
        }
        else if (status === 'out_for_delivery') {
            this.notifications.notifyPush(updated.customerId, 'out_for_delivery', (0, out_for_delivery_1.outForDeliveryCustomerPush)(orderCode, orderId, type, updated.deliveryOtp));
        }
        else if (['preparing', 'ready', 'handed_over'].includes(status) && !updated.deliveryPartnerId) {
            await this.delivery.triggerAssignment(type, orderId);
        }
        return timeline();
    }
    async assignPartnerByAdmin(adminUserId, type, orderId, partnerId) {
        await this.delivery.adminAssignPartner(adminUserId, type, orderId, partnerId);
        return type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
    }
    async acceptOrderByAdmin(adminUserId, type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (['cancelled', 'failed', 'delivered'].includes(order.status)) {
            throw new common_1.BadRequestException(`Cannot accept order in "${order.status}" status`);
        }
        if (order.status !== 'placed') {
            throw new common_1.BadRequestException(`Order has already been accepted (current status: "${order.status}")`);
        }
        await this.requirePaymentSatisfied(type, orderId);
        if (type === 'grocery') {
            const [attempt] = await this.db
                .select()
                .from(schema_1.allocationAttempts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, orderId), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.outcome, 'pending')))
                .limit(1);
            if (attempt) {
                await this.allocation.handleAcceptance(attempt.id);
            }
        }
        const [updated] = await this.db
            .update(table)
            .set({ status: 'vendor_accepted' })
            .where((0, drizzle_orm_1.eq)(table.id, orderId))
            .returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'vendor_accepted',
            actorRole: 'admin',
            changedBy: adminUserId,
        });
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(updated.customerId, 'order_confirmed', (0, order_confirmed_1.orderConfirmedCustomerPush)(orderCode, orderId, type));
        const vendorUserId = await this.vendorUserIdForOrder(type, updated);
        if (vendorUserId) {
            this.notifications.notifyPush(vendorUserId, 'order_confirmed', {
                title: 'Order accepted by Admin',
                body: `Order ${orderCode} has been accepted by Admin on your behalf. Please prepare the items.`,
                data: { event: 'order_confirmed', orderId, type, link: `/orders/${orderId}` },
            });
        }
        return type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
    }
    async createOrderForCustomer(adminUserId, type, customerId, dto, paymentMethod) {
        const [customer] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, customerId)).limit(1);
        if (!customer || customer.role !== 'customer')
            throw new common_1.NotFoundException('Customer not found');
        const actor = { userId: adminUserId, role: 'admin' };
        const created = type === 'grocery'
            ? await this.createGroceryOrder(customerId, dto, actor)
            : await this.createFoodOrder(customerId, dto, actor);
        if (created.paymentStatus === 'pending') {
            await this.payments.initiate(type, created.id, customerId, paymentMethod === 'cod' ? 'cod' : 'online');
            if (paymentMethod === 'paid')
                await this.payments.confirmByCustomer(type, created.id, customerId);
        }
        return type === 'grocery'
            ? this.getGroceryOrder(created.id, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(created.id, { userId: adminUserId, role: 'admin' });
    }
    async restoreOrder(adminUserId, type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!['cancelled', 'failed'].includes(order.status)) {
            throw new common_1.BadRequestException(`Only cancelled or failed orders can be restored (current status: "${order.status}")`);
        }
        await this.payments.restorePaymentStatusIfRestored(type, orderId);
        await this.wallet.restorePendingCommission(type, orderId);
        let revertedPaymentStatus = order.paymentStatus;
        if (revertedPaymentStatus === 'refund_pending') {
            revertedPaymentStatus = 'paid';
        }
        const [updated] = await this.db
            .update(table)
            .set({ status: 'placed', paymentStatus: revertedPaymentStatus })
            .where((0, drizzle_orm_1.eq)(table.id, orderId))
            .returning();
        if (type === 'grocery') {
            const groceryOrder = order;
            if (groceryOrder.vendorId) {
                const [existingPending] = await this.db
                    .select()
                    .from(schema_1.allocationAttempts)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, orderId), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.outcome, 'pending')))
                    .limit(1);
                if (!existingPending) {
                    await this.allocation.createAttempt(orderId, groceryOrder.vendorId, 1);
                }
            }
        }
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'placed',
            actorRole: 'admin',
            changedBy: adminUserId,
        });
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(updated.customerId, 'order_restored', {
            title: 'Order Restored',
            body: `Your order ${orderCode} has been restored by support and is now active.`,
            data: { event: 'order_restored', orderId, type, link: `/order/${orderId}?type=${type}` },
        });
        const vendorUserId = await this.vendorUserIdForOrder(type, updated);
        if (vendorUserId) {
            this.notifications.notifyPush(vendorUserId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(orderCode, 1, orderId, type));
        }
        return type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
            : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
    }
    async changeOrderVendor(adminUserId, type, orderId, dto) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.status === 'delivered') {
            throw new common_1.BadRequestException('Cannot change vendor for a completed/delivered order');
        }
        if (order.status === 'picked_up' || order.status === 'out_for_delivery') {
            throw new common_1.BadRequestException(`Cannot change vendor once order is in physical delivery transit (${order.status})`);
        }
        if (order.status === 'cancelled' || order.status === 'failed') {
            throw new common_1.BadRequestException(`Cannot change vendor for "${order.status}" order — please restore the order first`);
        }
        const orderCode = this.orderCode(orderId);
        if (order.deliveryPartnerId) {
            const [partner] = await this.db
                .select()
                .from(schema_1.deliveryPartners)
                .where((0, drizzle_orm_1.eq)(schema_1.deliveryPartners.id, order.deliveryPartnerId))
                .limit(1);
            if (partner) {
                this.notifications.notifyPush(partner.userId, 'order_cancelled', {
                    title: 'Order Reassigned',
                    body: `Order ${orderCode} was reassigned to another store by Admin. Pickup cancelled.`,
                    data: { event: 'assignment_cancelled', orderId, type },
                });
            }
            await this.db
                .update(schema_1.deliveryAssignments)
                .set({ outcome: 'timeout' })
                .where((0, drizzle_orm_1.and)(type === 'grocery'
                ? (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.groceryOrderId, orderId)
                : (0, drizzle_orm_1.eq)(schema_1.deliveryAssignments.foodOrderId, orderId), (0, drizzle_orm_1.inArray)(schema_1.deliveryAssignments.outcome, ['pending', 'accepted'])));
        }
        if (type === 'grocery') {
            const targetVendorId = dto.vendorId;
            if (!targetVendorId) {
                throw new common_1.BadRequestException('vendorId is required for grocery orders');
            }
            const [newVendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, targetVendorId)).limit(1);
            if (!newVendor)
                throw new common_1.NotFoundException('Target vendor not found');
            const groceryOrder = order;
            if (groceryOrder.vendorId === targetVendorId) {
                throw new common_1.BadRequestException('Order is already assigned to this vendor');
            }
            const oldVendorId = groceryOrder.vendorId;
            let oldVendorUserId = null;
            if (oldVendorId) {
                const [oldVendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, oldVendorId)).limit(1);
                oldVendorUserId = oldVendor?.userId ?? null;
            }
            const [pendingAttempt] = await this.db
                .select()
                .from(schema_1.allocationAttempts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.allocationAttempts.groceryOrderId, orderId), (0, drizzle_orm_1.eq)(schema_1.allocationAttempts.outcome, 'pending')))
                .limit(1);
            if (pendingAttempt) {
                await this.allocation.handleRejection(pendingAttempt.id);
            }
            const [updated] = await this.db
                .update(schema_1.groceryOrders)
                .set({ vendorId: targetVendorId, status: 'placed', deliveryPartnerId: null })
                .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.id, orderId))
                .returning();
            await this.allocation.createAttempt(orderId, targetVendorId, 1);
            await this.db.insert(schema_1.orderStatusHistory).values({
                groceryOrderId: orderId,
                status: 'placed',
                actorRole: 'admin',
                changedBy: adminUserId,
            });
            this.notifications.notifyPush(updated.customerId, 'order_placed', {
                title: 'Store Updated',
                body: `Your order ${orderCode} has been reassigned to ${newVendor.businessName}.`,
                data: { event: 'order_updated', orderId, type: 'grocery', link: `/order/${orderId}?type=grocery` },
            });
            if (oldVendorUserId) {
                this.notifications.notifyPush(oldVendorUserId, 'order_cancelled', {
                    title: 'Order Reassigned',
                    body: `Order ${orderCode} has been reassigned to another store by Admin.`,
                    data: { event: 'order_reassigned', orderId, type: 'grocery' },
                });
            }
            if (newVendor.userId) {
                this.notifications.notifyPush(newVendor.userId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(orderCode, 1, orderId, 'grocery'));
            }
            return this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' });
        }
        else {
            let targetRestaurantId = dto.restaurantId;
            if (!targetRestaurantId && dto.vendorId) {
                const [foundRest] = await this.db
                    .select()
                    .from(schema_1.restaurants)
                    .where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, dto.vendorId))
                    .limit(1);
                if (foundRest)
                    targetRestaurantId = foundRest.id;
            }
            if (!targetRestaurantId) {
                throw new common_1.BadRequestException('restaurantId or vendorId is required for food orders');
            }
            const [newRestaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, targetRestaurantId)).limit(1);
            if (!newRestaurant)
                throw new common_1.NotFoundException('Target restaurant not found');
            const foodOrder = order;
            if (foodOrder.restaurantId === targetRestaurantId) {
                throw new common_1.BadRequestException('Order is already assigned to this restaurant');
            }
            const oldRestaurantId = foodOrder.restaurantId;
            let oldRestaurantVendorUserId = null;
            if (oldRestaurantId) {
                const [oldRest] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, oldRestaurantId)).limit(1);
                if (oldRest?.vendorId) {
                    const [oldVend] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, oldRest.vendorId)).limit(1);
                    oldRestaurantVendorUserId = oldVend?.userId ?? null;
                }
            }
            const [updated] = await this.db
                .update(schema_1.foodOrders)
                .set({ restaurantId: targetRestaurantId, status: 'placed', deliveryPartnerId: null })
                .where((0, drizzle_orm_1.eq)(schema_1.foodOrders.id, orderId))
                .returning();
            await this.db.insert(schema_1.orderStatusHistory).values({
                foodOrderId: orderId,
                status: 'placed',
                actorRole: 'admin',
                changedBy: adminUserId,
            });
            this.notifications.notifyPush(updated.customerId, 'order_placed', {
                title: 'Restaurant Updated',
                body: `Your order ${orderCode} has been reassigned to ${newRestaurant.name}.`,
                data: { event: 'order_updated', orderId, type: 'food', link: `/order/${orderId}?type=food` },
            });
            if (oldRestaurantVendorUserId) {
                this.notifications.notifyPush(oldRestaurantVendorUserId, 'order_cancelled', {
                    title: 'Order Reassigned',
                    body: `Order ${orderCode} has been reassigned to another restaurant by Admin.`,
                    data: { event: 'order_reassigned', orderId, type: 'food' },
                });
            }
            if (newRestaurant.vendorId) {
                const [newVend] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, newRestaurant.vendorId)).limit(1);
                if (newVend?.userId) {
                    this.notifications.notifyPush(newVend.userId, 'order_placed', (0, order_placed_1.orderPlacedVendorPush)(orderCode, 1, orderId, 'food'));
                }
            }
            return this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
        }
    }
    async listCustomerAddressesForAdmin(customerId) {
        return this.db.select().from(schema_1.addresses).where((0, drizzle_orm_1.eq)(schema_1.addresses.userId, customerId));
    }
    async cancelOrderForCustomer(customerId, type, orderId) {
        const table = type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.customerId !== customerId)
            throw new common_1.ForbiddenException('You can only cancel your own orders');
        if (['delivered', 'failed', 'cancelled'].includes(order.status)) {
            throw new common_1.BadRequestException(`Order is already "${order.status}" — nothing to cancel`);
        }
        if (order.status !== 'placed') {
            throw new common_1.BadRequestException('Order can only be cancelled while waiting for store confirmation');
        }
        const [updated] = await this.db.update(table).set({ status: 'cancelled' }).where((0, drizzle_orm_1.eq)(table.id, orderId)).returning();
        await this.db.insert(schema_1.orderStatusHistory).values({
            ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
            status: 'cancelled',
            actorRole: 'customer',
            changedBy: customerId,
        });
        await this.payments.markRefundPendingIfPaid(type, orderId);
        await this.wallet.cancelPendingCommission(type, orderId);
        const orderCode = this.orderCode(orderId);
        this.notifications.notifyPush(updated.customerId, 'order_cancelled', (0, order_cancelled_1.orderCancelledCustomerPush)(orderCode, orderId, type));
        const vendorKnewOrder = CONFIRMED_PAYMENT_STATUSES.includes(updated.paymentStatus);
        const vendorUserId = vendorKnewOrder ? await this.vendorUserIdForOrder(type, updated) : null;
        if (vendorUserId)
            this.notifications.notifyPush(vendorUserId, 'order_cancelled', (0, order_cancelled_1.orderCancelledVendorPush)(orderCode, orderId));
        return type === 'grocery'
            ? this.getGroceryOrder(orderId, { userId: customerId, role: 'customer' })
            : this.getFoodOrder(orderId, { userId: customerId, role: 'customer' });
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
    async recordPendingAffiliateCommission(order, type) {
        try {
            const [coupon] = await this.db
                .select()
                .from(schema_1.coupons)
                .where((0, drizzle_orm_1.eq)(schema_1.coupons.code, order.couponCode))
                .limit(1);
            if (!coupon ||
                !coupon.beneficiaryUserId ||
                coupon.affiliateCommissionValue == null ||
                coupon.affiliateCommissionValue <= 0) {
                return;
            }
            let commission = 0;
            if (coupon.affiliateCommissionType === 'order_percentage') {
                commission = Math.round(((order.subtotal * coupon.affiliateCommissionValue) / 100) * 100) / 100;
            }
            else if (coupon.affiliateCommissionType === 'percentage') {
                commission = Math.round(((order.platformCommission * coupon.affiliateCommissionValue) / 100) * 100) / 100;
            }
            else {
                commission = Math.min(coupon.affiliateCommissionValue, order.platformCommission);
            }
            if (commission > 0) {
                await this.wallet.recordPendingCommission({
                    userId: coupon.beneficiaryUserId,
                    amount: commission,
                    orderId: order.id,
                    orderType: type,
                    couponCode: coupon.code,
                });
            }
        }
        catch (err) {
            console.error('[OrderService] recordPendingAffiliateCommission failed:', err);
        }
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
        revenue_config_service_1.RevenueConfigService,
        coupon_service_1.CouponService,
        vendor_discounts_service_1.VendorDiscountsService,
        wallet_service_1.WalletService])
], OrderService);
//# sourceMappingURL=order.service.js.map