import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  addresses,
  allocationAttempts,
  deliveryPartners,
  foodOrderItems,
  foodOrderRatings,
  foodOrders,
  groceryOrderItems,
  groceryOrders,
  menuCategories,
  menuItemAddons,
  menuItemVariants,
  menuItems,
  orderStatusHistory,
  products,
  restaurants,
  users,
  vendors,
} from '../../../drizzle/schema';
import { AllocationService } from '../allocation/allocation.service';
import { CatalogService } from '../catalog/catalog.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { orderPlacedCustomerPush, orderPlacedVendorPush } from '../notification/templates/push/order-placed';
import { orderConfirmedCustomerPush } from '../notification/templates/push/order-confirmed';
import { orderCancelledCustomerPush, orderCancelledPartnerPush, orderCancelledVendorPush } from '../notification/templates/push/order-cancelled';
import { RevenueConfigService } from '../revenue/revenue-config.service';
import { isVendorOpenNow } from '../catalog/catalog.types';
import type { CreateGroceryOrderDto } from './dto/create-grocery-order.dto';
import type { CreateFoodOrderDto } from './dto/create-food-order.dto';
import type { AdvanceStatusDto, CorrectStatusDto } from './dto/advance-status.dto';

const STATUS_SEQUENCE = ['vendor_accepted', 'preparing', 'ready', 'handed_over'] as const;

@Injectable()
export class OrderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly allocation: AllocationService,
    private readonly catalog: CatalogService,
    private readonly delivery: DeliveryService,
    private readonly payments: PaymentService,
    private readonly notifications: NotificationService,
    private readonly revenueConfig: RevenueConfigService,
  ) {}

  private orderCode(orderId: string): string {
    return orderId.slice(0, 8).toUpperCase();
  }

  // ---------- Customer: checkout ----------

  async createGroceryOrder(customerId: string, dto: CreateGroceryOrderDto) {
    const [address] = await this.db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, dto.deliveryAddressId), eq(addresses.userId, customerId)))
      .limit(1);
    if (!address) throw new BadRequestException('Delivery address not found');

    const candidate = await this.allocation.findBestVendor(dto.items, address.lat, address.lng);
    if (!candidate) {
      throw new BadRequestException(
        'No vendor can currently fulfill this cart within your delivery area — try adjusting your cart or address',
      );
    }

    const subtotal = dto.items.reduce(
      (sum, line) => sum + (candidate.unitPrices.get(line.productId) ?? 0) * line.qty,
      0,
    );

    // Resolved and snapshotted once, here, at order-creation time — never
    // re-derived later (TRD Section 3.5: a later revenue_config change
    // must never retroactively alter an already-placed order). Category
    // scope uses the first line's product category as a pragmatic
    // simplification — a cart can span categories within one vendor, and
    // there's no single "the" category to resolve against otherwise;
    // flagged in CLAUDE.md, not silently assumed correct for every cart.
    const [firstProduct] = await this.db.select().from(products).where(eq(products.id, dto.items[0].productId)).limit(1);
    const revenue = await this.revenueConfig.resolve(candidate.vendorId, firstProduct?.categoryId ?? null);
    const deliveryFee = revenue.deliveryFeeFlat;
    const commissionPct = revenue.commissionPct;
    const total = subtotal + deliveryFee;

    const [order] = await this.db
      .insert(groceryOrders)
      .values({
        customerId,
        status: 'placed',
        subtotal,
        deliveryFee,
        platformCommission: subtotal * commissionPct,
        commissionPct,
        total,
        vendorId: candidate.vendorId,
        deliveryAddressId: dto.deliveryAddressId,
      })
      .returning();

    await this.db.insert(groceryOrderItems).values(
      dto.items.map((line) => ({
        groceryOrderId: order.id,
        productId: line.productId,
        qty: line.qty,
        unitPrice: candidate.unitPrices.get(line.productId) ?? 0,
      })),
    );

    await this.db.insert(orderStatusHistory).values({
      groceryOrderId: order.id,
      status: 'placed',
      actorRole: 'customer',
      changedBy: customerId,
    });

    await this.allocation.createAttempt(order.id, candidate.vendorId, 1);

    this.notifications.notifyPush(customerId, 'order_placed', orderPlacedCustomerPush(this.orderCode(order.id), total));
    const [vendorRow] = await this.db.select().from(vendors).where(eq(vendors.id, candidate.vendorId)).limit(1);
    if (vendorRow) {
      this.notifications.notifyPush(vendorRow.userId, 'order_placed', orderPlacedVendorPush(this.orderCode(order.id), dto.items.length));
    }

    return this.getGroceryOrder(order.id, { userId: customerId, role: 'customer' });
  }

  async createFoodOrder(customerId: string, dto: CreateFoodOrderDto) {
    const [address] = await this.db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, dto.deliveryAddressId), eq(addresses.userId, customerId)))
      .limit(1);
    if (!address) throw new BadRequestException('Delivery address not found');

    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, dto.restaurantId)).limit(1);
    if (!restaurant) throw new BadRequestException('Restaurant not available');
    // Post-Phase-11 MVP-completion pass (Business Hours) — restaurant.isOpen
    // alone can go stale against the real weekly schedule (it's only
    // manually toggled), so the vendor's actual current status decides
    // whether checkout is allowed, not just the stored column.
    const [restaurantVendor] = await this.db.select().from(vendors).where(eq(vendors.id, restaurant.vendorId)).limit(1);
    if (!restaurant.isOpen || !restaurantVendor || !isVendorOpenNow(restaurantVendor)) {
      throw new BadRequestException('Restaurant not available');
    }

    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const items = await this.db.select().from(menuItems).where(inArray(menuItems.id, menuItemIds));

    // Single-restaurant-per-order, enforced server-side (TRD Section 4.2) —
    // every item's menu_category must trace back to the requested
    // restaurant, not just whatever the client claims restaurantId is.
    const catIds = [...new Set(items.map((i) => i.menuCategoryId))];
    const cats = catIds.length
      ? await this.db.select().from(menuCategories).where(inArray(menuCategories.id, catIds))
      : [];
    const catByI = new Map(cats.map((c) => [c.id, c]));

    if (items.length !== menuItemIds.length) {
      throw new BadRequestException('One or more menu items not found');
    }
    const foreignItem = items.find((item) => catByI.get(item.menuCategoryId)?.restaurantId !== dto.restaurantId);
    if (foreignItem) {
      throw new BadRequestException(
        `Menu item "${foreignItem.name}" does not belong to this restaurant — an order can only contain items from one restaurant`,
      );
    }

    const itemById = new Map(items.map((i) => [i.id, i]));
    const variantIds = dto.items.map((i) => i.variantId).filter((id): id is string => !!id);
    const addonIds = dto.items.flatMap((i) => i.addonIds ?? []);
    const variantRows = variantIds.length
      ? await this.db.select().from(menuItemVariants).where(inArray(menuItemVariants.id, variantIds))
      : [];
    const addonRows = addonIds.length
      ? await this.db.select().from(menuItemAddons).where(inArray(menuItemAddons.id, addonIds))
      : [];
    const variantById = new Map(variantRows.map((v) => [v.id, v]));
    const addonById = new Map(addonRows.map((a) => [a.id, a]));

    let subtotal = 0;
    const orderItemRows = dto.items.map((line) => {
      const item = itemById.get(line.menuItemId)!;
      const variant = line.variantId ? variantById.get(line.variantId) : undefined;
      const selectedAddons = (line.addonIds ?? []).map((id) => addonById.get(id)).filter((a): a is NonNullable<typeof a> => !!a);
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

    // No category-scope resolution for food — menu items use restaurants'
    // own `menu_categories`, a different table from the `categories`
    // product-catalog uses that revenue_config's category scope refers
    // to; vendor-scope (falling back to global) is what applies here.
    const revenue = await this.revenueConfig.resolve(restaurant.vendorId, null);
    const deliveryFee = revenue.deliveryFeeFlat;
    const commissionPct = revenue.commissionPct;
    const total = subtotal + deliveryFee;
    const [order] = await this.db
      .insert(foodOrders)
      .values({
        customerId,
        status: 'placed',
        subtotal,
        deliveryFee,
        platformCommission: subtotal * commissionPct,
        commissionPct,
        total,
        restaurantId: dto.restaurantId,
        deliveryAddressId: dto.deliveryAddressId,
      })
      .returning();

    await this.db.insert(foodOrderItems).values(orderItemRows.map((r) => ({ ...r, foodOrderId: order.id })));

    await this.db.insert(orderStatusHistory).values({
      foodOrderId: order.id,
      status: 'placed',
      actorRole: 'customer',
      changedBy: customerId,
    });

    this.notifications.notifyPush(customerId, 'order_placed', orderPlacedCustomerPush(this.orderCode(order.id), total));
    const [vendorRow] = await this.db.select().from(vendors).where(eq(vendors.id, restaurant.vendorId)).limit(1);
    if (vendorRow) {
      this.notifications.notifyPush(vendorRow.userId, 'order_placed', orderPlacedVendorPush(this.orderCode(order.id), dto.items.length));
    }

    return this.getFoodOrder(order.id, { userId: customerId, role: 'customer' });
  }

  // ---------- Customer: read own orders ----------

  async listMyGroceryOrders(customerId: string) {
    return this.db
      .select()
      .from(groceryOrders)
      .where(eq(groceryOrders.customerId, customerId))
      .orderBy(desc(groceryOrders.createdAt));
  }

  async listMyFoodOrders(customerId: string) {
    return this.db.select().from(foodOrders).where(eq(foodOrders.customerId, customerId)).orderBy(desc(foodOrders.createdAt));
  }

  async getGroceryOrder(id: string, requester: { userId: string; role: string }) {
    const [order] = await this.db.select().from(groceryOrders).where(eq(groceryOrders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    await this.assertOrderAccess(order.customerId, order.vendorId, requester);

    const items = await this.db.select().from(groceryOrderItems).where(eq(groceryOrderItems.groceryOrderId, id));
    const history = await this.db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.groceryOrderId, id))
      .orderBy(orderStatusHistory.changedAt);
    const customer = await this.customerSummary(order.customerId, order.deliveryAddressId);
    return this.withOtpVisibility({ ...order, items, history: await this.enrichHistory(history), customer }, requester);
  }

  async getFoodOrder(id: string, requester: { userId: string; role: string }) {
    const [order] = await this.db.select().from(foodOrders).where(eq(foodOrders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    await this.assertOrderAccess(order.customerId, restaurant?.vendorId, requester);

    const items = await this.db.select().from(foodOrderItems).where(eq(foodOrderItems.foodOrderId, id));
    const history = await this.db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.foodOrderId, id))
      .orderBy(orderStatusHistory.changedAt);
    const customer = await this.customerSummary(order.customerId, order.deliveryAddressId);
    const [rating] = await this.db.select().from(foodOrderRatings).where(eq(foodOrderRatings.foodOrderId, id)).limit(1);
    return this.withOtpVisibility(
      { ...order, items, history: await this.enrichHistory(history), customer, myRating: rating ?? null },
      requester,
    );
  }

  // Post-Phase-11 MVP-completion pass (Ratings). Only the customer who
  // placed the order can rate it, only once it's genuinely `delivered`
  // (not e.g. right after placing), and only once ever — food only, per
  // PRD Section 5's "Food: ... ratings" row (grocery has no ratings
  // concept anywhere in the PRD/TRD).
  async rateFoodOrder(customerId: string, foodOrderId: string, dto: { rating: number; comment?: string }) {
    const [order] = await this.db.select().from(foodOrders).where(eq(foodOrders.id, foodOrderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId) throw new ForbiddenException('Not your order');
    if (order.status !== 'delivered') throw new BadRequestException('Order has not been delivered yet');

    const [existing] = await this.db.select().from(foodOrderRatings).where(eq(foodOrderRatings.foodOrderId, foodOrderId)).limit(1);
    if (existing) throw new BadRequestException('Order already rated');

    const [row] = await this.db
      .insert(foodOrderRatings)
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

  // The delivery OTP is a doorstep-verification secret the customer reads
  // out loud — it must never be visible to the vendor, delivery partner
  // (they're the one entering it, not seeing it) or admin, only the
  // customer whose order it is.
  private withOtpVisibility<T extends { deliveryOtp: string | null }>(
    order: T,
    requester: { userId: string; role: string },
  ): T {
    if (requester.role === 'customer') return order;
    return { ...order, deliveryOtp: null };
  }

  // For the Admin timeline (TRD Section 9.4) — "who did this" per entry.
  // No customer/admin "name" field exists anywhere yet, so phone/email
  // stand in; vendors have a real businessName to use instead.
  private async enrichHistory(history: (typeof orderStatusHistory.$inferSelect)[]) {
    const userIds = [...new Set(history.map((h) => h.changedBy).filter((id): id is string => !!id))];
    const userRows = userIds.length ? await this.db.select().from(users).where(inArray(users.id, userIds)) : [];
    const userById = new Map(userRows.map((u) => [u.id, u]));

    const vendorUserIds = userRows.filter((u) => u.role === 'vendor').map((u) => u.id);
    const vendorRows = vendorUserIds.length
      ? await this.db.select().from(vendors).where(inArray(vendors.userId, vendorUserIds))
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

  // No customer "name" field exists anywhere yet (accounts are phone+OTP
  // only, no profile/name capture in any phase so far) — phone stands in
  // for it. Addresses only store one formattedAddress string, not
  // line1/area/city, so those are left blank rather than guessed at.
  private async customerSummary(customerId: string, deliveryAddressId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, customerId)).limit(1);
    const [address] = await this.db.select().from(addresses).where(eq(addresses.id, deliveryAddressId)).limit(1);
    return {
      name: user?.phone ?? 'Customer',
      phone: user?.phone ?? '',
      line1: address?.formattedAddress ?? '',
      area: '',
      city: '',
    };
  }

  private async assertOrderAccess(customerId: string, orderVendorId: string | null | undefined, requester: { userId: string; role: string }) {
    if (requester.role === 'admin') return;
    if (requester.role === 'customer' && requester.userId === customerId) return;
    if (requester.role === 'vendor') {
      const vendor = await this.catalog.getVendorByUserId(requester.userId);
      if (vendor && orderVendorId === vendor.id) return;
    }
    throw new ForbiddenException('Not your order');
  }

  // ---------- Vendor: grocery ----------

  /** List views show item count/first item name (vendor OrderCard) — attach items, skip full customer/history. */
  private async attachGroceryItems<T extends { id: string }>(orders: T[]) {
    if (orders.length === 0) return orders.map((o) => ({ ...o, items: [] }));
    const ids = orders.map((o) => o.id);
    const items = await this.db.select().from(groceryOrderItems).where(inArray(groceryOrderItems.groceryOrderId, ids));
    return orders.map((o) => ({ ...o, items: items.filter((i) => i.groceryOrderId === o.id) }));
  }

  private async attachFoodItems<T extends { id: string }>(orders: T[]) {
    if (orders.length === 0) return orders.map((o) => ({ ...o, items: [] }));
    const ids = orders.map((o) => o.id);
    const items = await this.db.select().from(foodOrderItems).where(inArray(foodOrderItems.foodOrderId, ids));
    return orders.map((o) => ({ ...o, items: items.filter((i) => i.foodOrderId === o.id) }));
  }

  async listVendorIncomingGroceryOrders(userId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const rows = await this.db
      .select({ attempt: allocationAttempts, order: groceryOrders })
      .from(allocationAttempts)
      .innerJoin(groceryOrders, eq(allocationAttempts.groceryOrderId, groceryOrders.id))
      .where(and(eq(allocationAttempts.vendorId, vendor.id), eq(allocationAttempts.outcome, 'pending')));
    const orders = rows.map((r) => ({ ...r.order, slaDeadline: r.attempt.slaDeadline, attemptId: r.attempt.id }));
    return this.attachGroceryItems(orders);
  }

  // Terminal orders (Phase 5 finally makes 'delivered' reachable) — the
  // vendor app's Order History screen has been filtering for these statuses
  // since Phase 4 but had no endpoint to source them from; "active" only
  // ever covers what the vendor still has to act on.
  async listVendorHistoryGroceryOrders(userId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const orders = await this.db
      .select()
      .from(groceryOrders)
      .where(
        and(
          eq(groceryOrders.vendorId, vendor.id),
          or(
            eq(groceryOrders.status, 'delivered'),
            eq(groceryOrders.status, 'failed'),
            eq(groceryOrders.status, 'cancelled'),
          ),
        ),
      )
      .orderBy(desc(groceryOrders.createdAt))
      .limit(100);
    return this.attachGroceryItems(orders);
  }

  async listVendorHistoryFoodOrders(userId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const restaurant = await this.catalog.getOrCreateRestaurant(vendor.id);
    const orders = await this.db
      .select()
      .from(foodOrders)
      .where(
        and(
          eq(foodOrders.restaurantId, restaurant.id),
          or(
            eq(foodOrders.status, 'delivered'),
            eq(foodOrders.status, 'failed'),
            eq(foodOrders.status, 'cancelled'),
          ),
        ),
      )
      .orderBy(desc(foodOrders.createdAt))
      .limit(100);
    return this.attachFoodItems(orders);
  }

  async listVendorActiveGroceryOrders(userId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const orders = await this.db
      .select()
      .from(groceryOrders)
      .where(
        and(
          eq(groceryOrders.vendorId, vendor.id),
          or(
            eq(groceryOrders.status, 'vendor_accepted'),
            eq(groceryOrders.status, 'preparing'),
            eq(groceryOrders.status, 'ready'),
            eq(groceryOrders.status, 'handed_over'),
          ),
        ),
      )
      .orderBy(desc(groceryOrders.createdAt));
    return this.attachGroceryItems(orders);
  }

  async acceptGroceryOrder(userId: string, orderId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const attempt = await this.requirePendingAttempt(orderId, vendor.id);
    await this.requirePaymentSatisfied('grocery', orderId);

    await this.allocation.handleAcceptance(attempt.id);
    const [updated] = await this.db
      .update(groceryOrders)
      .set({ status: 'vendor_accepted' })
      .where(eq(groceryOrders.id, orderId))
      .returning();
    await this.db.insert(orderStatusHistory).values({
      groceryOrderId: orderId,
      status: 'vendor_accepted',
      actorRole: 'vendor',
      changedBy: userId,
    });
    this.notifications.notifyPush(updated.customerId, 'order_confirmed', orderConfirmedCustomerPush(this.orderCode(orderId)));
    return this.getGroceryOrder(orderId, { userId, role: 'vendor' });
  }

  async rejectGroceryOrder(userId: string, orderId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const attempt = await this.requirePendingAttempt(orderId, vendor.id);
    // Silent reallocation — no order_status_history entry (customer never
    // sees a rejection happen, per PRD Section 7.2).
    await this.allocation.handleRejection(attempt.id);
    return { ok: true };
  }

  private async requirePendingAttempt(groceryOrderId: string, vendorId: string) {
    const [attempt] = await this.db
      .select()
      .from(allocationAttempts)
      .where(
        and(
          eq(allocationAttempts.groceryOrderId, groceryOrderId),
          eq(allocationAttempts.vendorId, vendorId),
          eq(allocationAttempts.outcome, 'pending'),
        ),
      )
      .limit(1);
    if (!attempt) throw new NotFoundException('No pending allocation for this order and vendor');
    return attempt;
  }

  // Phase 6: an order can only reach vendor-accepted ("confirmed") once
  // payment is resolved one way or another — paid online, or COD (which is
  // always immediately fine, collected only at delivery). Reads the
  // denormalized paymentStatus column directly rather than round-tripping
  // through PaymentService, since OrderService already has the order row.
  private async requirePaymentSatisfied(type: 'grocery' | 'food', orderId: string) {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order || !this.payments.isSatisfied(order.paymentStatus)) {
      throw new BadRequestException('Payment has not been confirmed for this order yet');
    }
  }

  async advanceGroceryOrder(userId: string, orderId: string, dto: AdvanceStatusDto) {
    const vendor = await this.catalog.requireVendor(userId);
    const order = await this.requireOwnGroceryOrder(orderId, vendor.id);
    this.assertForwardTransition(order.status, dto.status);

    await this.db.update(groceryOrders).set({ status: dto.status }).where(eq(groceryOrders.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      groceryOrderId: orderId,
      status: dto.status,
      actorRole: 'vendor',
      changedBy: userId,
    });

    // Vendor's last manual action — hand off to Delivery for partner matching.
    if (dto.status === 'handed_over') {
      await this.delivery.triggerAssignment('grocery', orderId);
    }

    return this.getGroceryOrder(orderId, { userId, role: 'vendor' });
  }

  async correctGroceryOrderStatus(userId: string, orderId: string, dto: CorrectStatusDto) {
    const vendor = await this.catalog.requireVendor(userId);
    const order = await this.requireOwnGroceryOrder(orderId, vendor.id);
    this.assertCorrection(order.status, dto.status);

    await this.db.update(groceryOrders).set({ status: dto.status }).where(eq(groceryOrders.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      groceryOrderId: orderId,
      status: dto.status,
      actorRole: 'vendor',
      changedBy: userId,
    });
    return this.getGroceryOrder(orderId, { userId, role: 'vendor' });
  }

  private async requireOwnGroceryOrder(orderId: string, vendorId: string) {
    const [order] = await this.db.select().from(groceryOrders).where(eq(groceryOrders.id, orderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (order.vendorId !== vendorId) throw new ForbiddenException('Not your order');
    return order;
  }

  // ---------- Vendor: food ----------

  async listVendorIncomingFoodOrders(userId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const restaurant = await this.catalog.getOrCreateRestaurant(vendor.id);
    const orders = await this.db
      .select()
      .from(foodOrders)
      .where(and(eq(foodOrders.restaurantId, restaurant.id), eq(foodOrders.status, 'placed')))
      .orderBy(desc(foodOrders.createdAt));
    return this.attachFoodItems(orders);
  }

  async listVendorActiveFoodOrders(userId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const restaurant = await this.catalog.getOrCreateRestaurant(vendor.id);
    const orders = await this.db
      .select()
      .from(foodOrders)
      .where(
        and(
          eq(foodOrders.restaurantId, restaurant.id),
          or(
            eq(foodOrders.status, 'vendor_accepted'),
            eq(foodOrders.status, 'preparing'),
            eq(foodOrders.status, 'ready'),
            eq(foodOrders.status, 'handed_over'),
          ),
        ),
      )
      .orderBy(desc(foodOrders.createdAt));
    return this.attachFoodItems(orders);
  }

  private async requireOwnFoodOrder(orderId: string, vendorId: string) {
    const [order] = await this.db.select().from(foodOrders).where(eq(foodOrders.id, orderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    if (!restaurant || restaurant.vendorId !== vendorId) throw new ForbiddenException('Not your order');
    return order;
  }

  async acceptFoodOrder(userId: string, orderId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const order = await this.requireOwnFoodOrder(orderId, vendor.id);
    if (order.status !== 'placed') throw new BadRequestException('Order already responded to');
    await this.requirePaymentSatisfied('food', orderId);

    await this.db.update(foodOrders).set({ status: 'vendor_accepted' }).where(eq(foodOrders.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      foodOrderId: orderId,
      status: 'vendor_accepted',
      actorRole: 'vendor',
      changedBy: userId,
    });
    this.notifications.notifyPush(order.customerId, 'order_confirmed', orderConfirmedCustomerPush(this.orderCode(orderId)));
    return this.getFoodOrder(orderId, { userId, role: 'vendor' });
  }

  async rejectFoodOrder(userId: string, orderId: string) {
    const vendor = await this.catalog.requireVendor(userId);
    const order = await this.requireOwnFoodOrder(orderId, vendor.id);
    if (order.status !== 'placed') throw new BadRequestException('Order already responded to');

    // No reallocation concept for food (single restaurant chosen explicitly
    // by the customer) — a reject fails the order outright.
    await this.db.update(foodOrders).set({ status: 'failed' }).where(eq(foodOrders.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      foodOrderId: orderId,
      status: 'failed',
      actorRole: 'vendor',
      changedBy: userId,
    });
    // A vendor can reject before or after the customer already paid via
    // UPI (the payment gate only blocks *accept*, not the reject path) —
    // a no-op if payment never got past `pending`, or for COD.
    await this.payments.markRefundPendingIfPaid('food', orderId);
    // Matrix's "Order cancelled" row — mapped onto this real 'failed'
    // transition since no dedicated cancel endpoint exists (flagged in
    // CLAUDE.md). No delivery partner is ever assigned pre-accept, so
    // there's no partner-alert cell to fire here. The vendor cell fires
    // even though the vendor caused it themselves (rejecting is the only
    // real 'cancelled' trigger this row can attach to) — harmless, just a
    // same-action confirmation rather than a true third-party alert.
    this.notifications.notifyPush(order.customerId, 'order_cancelled', orderCancelledCustomerPush(this.orderCode(orderId)));
    this.notifications.notifyPush(userId, 'order_cancelled', orderCancelledVendorPush(this.orderCode(orderId)));
    return this.getFoodOrder(orderId, { userId, role: 'vendor' });
  }

  async advanceFoodOrder(userId: string, orderId: string, dto: AdvanceStatusDto) {
    const vendor = await this.catalog.requireVendor(userId);
    const order = await this.requireOwnFoodOrder(orderId, vendor.id);
    this.assertForwardTransition(order.status, dto.status);

    await this.db.update(foodOrders).set({ status: dto.status }).where(eq(foodOrders.id, orderId));
    await this.db.insert(orderStatusHistory).values({
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

  async correctFoodOrderStatus(userId: string, orderId: string, dto: CorrectStatusDto) {
    const vendor = await this.catalog.requireVendor(userId);
    const order = await this.requireOwnFoodOrder(orderId, vendor.id);
    this.assertCorrection(order.status, dto.status);

    await this.db.update(foodOrders).set({ status: dto.status }).where(eq(foodOrders.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      foodOrderId: orderId,
      status: dto.status,
      actorRole: 'vendor',
      changedBy: userId,
    });
    return this.getFoodOrder(orderId, { userId, role: 'vendor' });
  }

  // ---------- Shared status-transition rules ----------

  private assertForwardTransition(currentStatus: string, requested: string) {
    const currentIndex = STATUS_SEQUENCE.indexOf(currentStatus as (typeof STATUS_SEQUENCE)[number]);
    const requestedIndex = STATUS_SEQUENCE.indexOf(requested as (typeof STATUS_SEQUENCE)[number]);
    if (currentIndex === -1 || requestedIndex !== currentIndex + 1) {
      throw new BadRequestException(
        `Cannot move from "${currentStatus}" to "${requested}" — status must advance one step at a time`,
      );
    }
  }

  private assertCorrection(currentStatus: string, requested: string) {
    const currentIndex = STATUS_SEQUENCE.indexOf(currentStatus as (typeof STATUS_SEQUENCE)[number]);
    const requestedIndex = STATUS_SEQUENCE.indexOf(requested as (typeof STATUS_SEQUENCE)[number]);
    if (currentIndex === -1 || requestedIndex !== currentIndex - 1) {
      throw new BadRequestException(`"${requested}" is not the step immediately before "${currentStatus}"`);
    }
  }

  // ---------- Admin: unified view ----------

  async listAllOrdersForAdmin() {
    const grocery = await this.db.select().from(groceryOrders).orderBy(desc(groceryOrders.createdAt));
    const food = await this.db.select().from(foodOrders).orderBy(desc(foodOrders.createdAt));

    const customerIds = [...new Set([...grocery.map((o) => o.customerId), ...food.map((o) => o.customerId)])];
    const customerRows = customerIds.length
      ? await this.db.select().from(users).where(inArray(users.id, customerIds))
      : [];
    const customerPhoneById = new Map(customerRows.map((u) => [u.id, u.phone ?? '']));

    // deliveryOtp is stripped here the same way withOtpVisibility strips it
    // for the single-order admin timeline view — the list endpoint spreads
    // the raw row and would otherwise leak every order's doorstep code to
    // any admin request.
    return {
      grocery: grocery.map((o) => {
        const { deliveryOtp: _otp, ...rest } = o;
        return { ...rest, type: 'grocery' as const, customerName: customerPhoneById.get(o.customerId) ?? '' };
      }),
      food: food.map((o) => {
        const { deliveryOtp: _otp, ...rest } = o;
        return { ...rest, type: 'food' as const, customerName: customerPhoneById.get(o.customerId) ?? '' };
      }),
    };
  }

  async getOrderTimelineForAdmin(type: 'grocery' | 'food', id: string) {
    return type === 'grocery'
      ? this.getGroceryOrder(id, { userId: '', role: 'admin' })
      : this.getFoodOrder(id, { userId: '', role: 'admin' });
  }

  // Real "cancel order" (Phase 4 originally called for this, never built —
  // closed as housekeeping before Phase 8). Admin-triggered only; customer
  // self-service cancel isn't wired up here (flagged, not silently
  // skipped — would need its own eligibility rules, e.g. "only before
  // vendor_accepted", that nothing today defines). Any non-terminal order
  // can be cancelled; a delivery partner formally accepting an order is
  // the practical point past which cancelling stops making sense, but
  // there's no explicit business rule requiring that cutoff either, so
  // it's left to the admin's judgement rather than enforced here.
  async cancelOrder(adminUserId: string, type: 'grocery' | 'food', orderId: string) {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (['delivered', 'failed', 'cancelled'].includes(order.status)) {
      throw new BadRequestException(`Order is already "${order.status}" — nothing to cancel`);
    }

    const [updated] = await this.db.update(table).set({ status: 'cancelled' }).where(eq(table.id, orderId)).returning();
    await this.db.insert(orderStatusHistory).values({
      ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
      status: 'cancelled',
      actorRole: 'admin',
      changedBy: adminUserId,
    });

    // Same refund-pending hook Phase 6's housekeeping wired into every
    // other real 'failed' transition — a cancelled order that was already
    // paid via UPI owes the customer a refund exactly the same way.
    await this.payments.markRefundPendingIfPaid(type, orderId);

    const orderCode = this.orderCode(orderId);
    this.notifications.notifyPush(updated.customerId, 'order_cancelled', orderCancelledCustomerPush(orderCode));
    const vendorUserId = await this.vendorUserIdForOrder(type, updated);
    if (vendorUserId) this.notifications.notifyPush(vendorUserId, 'order_cancelled', orderCancelledVendorPush(orderCode));
    if (updated.deliveryPartnerId) {
      const [partner] = await this.db.select().from(deliveryPartners).where(eq(deliveryPartners.id, updated.deliveryPartnerId)).limit(1);
      if (partner) this.notifications.notifyPush(partner.userId, 'order_cancelled', orderCancelledPartnerPush(orderCode));
    }

    return type === 'grocery'
      ? this.getGroceryOrder(orderId, { userId: adminUserId, role: 'admin' })
      : this.getFoodOrder(orderId, { userId: adminUserId, role: 'admin' });
  }

  private async vendorUserIdForOrder(type: 'grocery' | 'food', order: { vendorId?: string | null; restaurantId?: string }): Promise<string | null> {
    let vendorId = type === 'grocery' ? order.vendorId : undefined;
    if (type === 'food' && order.restaurantId) {
      const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
      vendorId = restaurant?.vendorId;
    }
    if (!vendorId) return null;
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    return vendor?.userId ?? null;
  }
}
