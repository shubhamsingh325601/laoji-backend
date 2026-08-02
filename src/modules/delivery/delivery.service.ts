import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, or } from 'drizzle-orm';
import { randomInt } from 'crypto';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  addresses,
  deliveryAssignments,
  deliveryPartners,
  foodOrderItems,
  foodOrders,
  groceryOrderItems,
  groceryOrders,
  orderStatusHistory,
  restaurants,
  users,
  vendors,
} from '../../../drizzle/schema';
import { haversineKm } from '../catalog/catalog.types';
import { JobQueueService } from '../allocation/job-queue.service';
import { DELIVERY_SLA_SECONDS, MAX_DELIVERY_ASSIGNMENT_ATTEMPTS } from './delivery.constants';

type OrderType = 'grocery' | 'food';

const DELIVERY_SEQUENCE = ['delivery_assigned', 'picked_up', 'out_for_delivery', 'delivered'] as const;

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly jobQueue: JobQueueService,
  ) {}

  // ---------- Partner profile ----------

  async getPartnerByUserId(userId: string) {
    const [row] = await this.db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    return row ?? null;
  }

  async requirePartner(userId: string) {
    const partner = await this.getPartnerByUserId(userId);
    if (!partner) throw new NotFoundException('Delivery partner profile not set up yet');
    return partner;
  }

  async upsertProfile(userId: string, vehicleType: string) {
    const existing = await this.getPartnerByUserId(userId);
    if (existing) {
      const [updated] = await this.db
        .update(deliveryPartners)
        .set({ vehicleType })
        .where(eq(deliveryPartners.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db.insert(deliveryPartners).values({ userId, vehicleType }).returning();
    return created;
  }

  async setOnline(userId: string, isOnline: boolean) {
    const partner = await this.requirePartner(userId);
    const [updated] = await this.db
      .update(deliveryPartners)
      .set({ isOnline, updatedAt: new Date() })
      .where(eq(deliveryPartners.id, partner.id))
      .returning();
    return updated;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const partner = await this.requirePartner(userId);
    const [updated] = await this.db
      .update(deliveryPartners)
      .set({ currentLat: lat, currentLng: lng, updatedAt: new Date() })
      .where(eq(deliveryPartners.id, partner.id))
      .returning();
    return updated;
  }

  // ---------- Matching (TRD Section 7.3 / 9.3: nearest online partner, plain Haversine) ----------

  private async findNearestOnlinePartner(lat: number, lng: number, excludePartnerIds: string[]) {
    const online = await this.db.select().from(deliveryPartners).where(eq(deliveryPartners.isOnline, true));
    const candidates = online.filter(
      (p) => !excludePartnerIds.includes(p.id) && p.currentLat !== null && p.currentLng !== null,
    );
    if (candidates.length === 0) return null;

    let best = candidates[0];
    let bestDistance = haversineKm(lat, lng, best.currentLat!, best.currentLng!);
    for (const p of candidates.slice(1)) {
      const d = haversineKm(lat, lng, p.currentLat!, p.currentLng!);
      if (d < bestDistance) {
        best = p;
        bestDistance = d;
      }
    }
    return best;
  }

  private async pickupPoint(type: OrderType, orderId: string): Promise<{ lat: number; lng: number } | null> {
    if (type === 'grocery') {
      const [order] = await this.db.select().from(groceryOrders).where(eq(groceryOrders.id, orderId)).limit(1);
      if (!order?.vendorId) return null;
      const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, order.vendorId)).limit(1);
      return vendor ? { lat: vendor.pickupLat, lng: vendor.pickupLng } : null;
    }
    const [order] = await this.db.select().from(foodOrders).where(eq(foodOrders.id, orderId)).limit(1);
    if (!order) return null;
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    if (!restaurant) return null;
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, restaurant.vendorId)).limit(1);
    return vendor ? { lat: vendor.pickupLat, lng: vendor.pickupLng } : null;
  }

  /** Triggered by OrderService once the vendor marks an order `handed_over`. */
  async triggerAssignment(type: OrderType, orderId: string) {
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

  private async createAssignment(type: OrderType, orderId: string, partnerId: string, attemptNo: number) {
    const slaDeadline = new Date(Date.now() + DELIVERY_SLA_SECONDS * 1000);
    const [assignment] = await this.db
      .insert(deliveryAssignments)
      .values({
        ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
        deliveryPartnerId: partnerId,
        outcome: 'pending',
        attemptNo,
        slaDeadline,
      })
      .returning();

    this.jobQueue.schedule(assignment.id, DELIVERY_SLA_SECONDS * 1000, () => this.handleTimeout(assignment.id));
    return assignment;
  }

  async handleTimeout(assignmentId: string) {
    const [assignment] = await this.db.select().from(deliveryAssignments).where(eq(deliveryAssignments.id, assignmentId)).limit(1);
    if (!assignment || assignment.outcome !== 'pending') return;

    this.logger.log(`Delivery assignment ${assignmentId} timed out (partner ${assignment.deliveryPartnerId})`);
    await this.db.update(deliveryAssignments).set({ outcome: 'timeout' }).where(eq(deliveryAssignments.id, assignmentId));
    await this.reassign(assignment);
  }

  private async reassign(previous: typeof deliveryAssignments.$inferSelect) {
    const type: OrderType = previous.groceryOrderId ? 'grocery' : 'food';
    const orderId = (previous.groceryOrderId ?? previous.foodOrderId)!;

    if (previous.attemptNo >= MAX_DELIVERY_ASSIGNMENT_ATTEMPTS) {
      await this.markDeliveryFailed(type, orderId);
      return;
    }

    const previousAttempts = await this.db
      .select()
      .from(deliveryAssignments)
      .where(type === 'grocery' ? eq(deliveryAssignments.groceryOrderId, orderId) : eq(deliveryAssignments.foodOrderId, orderId));
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

  private async markDeliveryFailed(type: OrderType, orderId: string) {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    await this.db.update(table).set({ status: 'failed' }).where(eq(table.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
      status: 'failed',
      actorRole: 'system',
    });
  }

  // ---------- Delivery partner: order actions ----------

  private async requirePendingAssignment(type: OrderType, orderId: string, partnerId: string) {
    const [assignment] = await this.db
      .select()
      .from(deliveryAssignments)
      .where(
        and(
          type === 'grocery' ? eq(deliveryAssignments.groceryOrderId, orderId) : eq(deliveryAssignments.foodOrderId, orderId),
          eq(deliveryAssignments.deliveryPartnerId, partnerId),
          eq(deliveryAssignments.outcome, 'pending'),
        ),
      )
      .limit(1);
    if (!assignment) throw new NotFoundException('No pending assignment for this order and partner');
    return assignment;
  }

  /**
   * Enriched pickup/dropoff detail for the delivery-partner app's assignment
   * and active-delivery screens — the plain delivery_assignments row and
   * order-status list endpoints don't carry vendor name, customer contact,
   * or item counts, all of which that UI already expects.
   */
  async getOrderDetailForPartner(userId: string, type: OrderType, orderId: string) {
    const partner = await this.requirePartner(userId);

    if (type === 'grocery') {
      const [order] = await this.db.select().from(groceryOrders).where(eq(groceryOrders.id, orderId)).limit(1);
      if (!order) throw new NotFoundException('Order not found');
      const items = await this.db.select().from(groceryOrderItems).where(eq(groceryOrderItems.groceryOrderId, orderId));
      const [vendor] = order.vendorId
        ? await this.db.select().from(vendors).where(eq(vendors.id, order.vendorId)).limit(1)
        : [];
      const [address] = await this.db.select().from(addresses).where(eq(addresses.id, order.deliveryAddressId)).limit(1);
      const [customer] = await this.db.select().from(users).where(eq(users.id, order.customerId)).limit(1);
      return this.assembleAssignmentView(order, type, items.length, vendor, address, customer, partner.id);
    }

    const [order] = await this.db.select().from(foodOrders).where(eq(foodOrders.id, orderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    const items = await this.db.select().from(foodOrderItems).where(eq(foodOrderItems.foodOrderId, orderId));
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    const [vendor] = restaurant
      ? await this.db.select().from(vendors).where(eq(vendors.id, restaurant.vendorId)).limit(1)
      : [];
    const [address] = await this.db.select().from(addresses).where(eq(addresses.id, order.deliveryAddressId)).limit(1);
    const [customer] = await this.db.select().from(users).where(eq(users.id, order.customerId)).limit(1);
    return this.assembleAssignmentView(order, type, items.length, vendor, address, customer, partner.id, restaurant?.name);
  }

  private assembleAssignmentView(
    order: { id: string; status: string; deliveryFee: number; deliveryPartnerId: string | null },
    type: OrderType,
    itemCount: number,
    vendor: typeof vendors.$inferSelect | undefined,
    address: typeof addresses.$inferSelect | undefined,
    customer: typeof users.$inferSelect | undefined,
    requestingPartnerId: string,
    restaurantName?: string,
  ) {
    if (order.deliveryPartnerId && order.deliveryPartnerId !== requestingPartnerId) {
      throw new ForbiddenException('Not your delivery');
    }
    return {
      id: order.id,
      type,
      status: order.status,
      orderCode: order.id.slice(0, 8).toUpperCase(),
      itemCount,
      deliveryFee: order.deliveryFee,
      pickupName: restaurantName ?? vendor?.businessName ?? 'Pickup point',
      pickupLat: vendor?.pickupLat ?? null,
      pickupLng: vendor?.pickupLng ?? null,
      dropoffCustomer: customer?.phone ?? 'Customer',
      dropoffPhone: customer?.phone ?? '',
      dropoffAddress: address?.formattedAddress ?? '',
      dropoffLat: address?.lat ?? null,
      dropoffLng: address?.lng ?? null,
    };
  }

  async listIncoming(userId: string) {
    const partner = await this.requirePartner(userId);
    const rows = await this.db
      .select()
      .from(deliveryAssignments)
      .where(and(eq(deliveryAssignments.deliveryPartnerId, partner.id), eq(deliveryAssignments.outcome, 'pending')));
    return rows;
  }

  async listActive(userId: string) {
    const partner = await this.requirePartner(userId);
    const grocery = await this.db
      .select()
      .from(groceryOrders)
      .where(
        and(
          eq(groceryOrders.deliveryPartnerId, partner.id),
          or(
            eq(groceryOrders.status, 'delivery_assigned'),
            eq(groceryOrders.status, 'picked_up'),
            eq(groceryOrders.status, 'out_for_delivery'),
          ),
        ),
      );
    const food = await this.db
      .select()
      .from(foodOrders)
      .where(
        and(
          eq(foodOrders.deliveryPartnerId, partner.id),
          or(
            eq(foodOrders.status, 'delivery_assigned'),
            eq(foodOrders.status, 'picked_up'),
            eq(foodOrders.status, 'out_for_delivery'),
          ),
        ),
      );
    return { grocery, food };
  }

  async accept(userId: string, type: OrderType, orderId: string) {
    const partner = await this.requirePartner(userId);
    const assignment = await this.requirePendingAssignment(type, orderId, partner.id);
    this.jobQueue.cancel(assignment.id);
    await this.db.update(deliveryAssignments).set({ outcome: 'accepted' }).where(eq(deliveryAssignments.id, assignment.id));

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    await this.db
      .update(table)
      .set({ status: 'delivery_assigned', deliveryPartnerId: partner.id, deliveryOtp: otp })
      .where(eq(table.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
      status: 'delivery_assigned',
      actorRole: 'delivery_partner',
      changedBy: userId,
    });
    return { ok: true };
  }

  async reject(userId: string, type: OrderType, orderId: string) {
    const partner = await this.requirePartner(userId);
    const assignment = await this.requirePendingAssignment(type, orderId, partner.id);
    this.jobQueue.cancel(assignment.id);
    await this.db.update(deliveryAssignments).set({ outcome: 'rejected' }).where(eq(deliveryAssignments.id, assignment.id));
    // Silent reassignment — same "customer never sees the churn" rule Phase 4 applied to vendor rejections.
    await this.reassign(assignment);
    return { ok: true };
  }

  private async requireOwnActiveOrder(type: OrderType, orderId: string, partnerId: string) {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (order.deliveryPartnerId !== partnerId) throw new ForbiddenException('Not your delivery');
    return order;
  }

  async advance(userId: string, type: OrderType, orderId: string, status: 'picked_up' | 'out_for_delivery') {
    const partner = await this.requirePartner(userId);
    const order = await this.requireOwnActiveOrder(type, orderId, partner.id);

    const currentIndex = DELIVERY_SEQUENCE.indexOf(order.status as (typeof DELIVERY_SEQUENCE)[number]);
    const requestedIndex = DELIVERY_SEQUENCE.indexOf(status);
    if (currentIndex === -1 || requestedIndex !== currentIndex + 1) {
      throw new BadRequestException(`Cannot move from "${order.status}" to "${status}" — status must advance one step at a time`);
    }

    const table = type === 'grocery' ? groceryOrders : foodOrders;
    await this.db.update(table).set({ status }).where(eq(table.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
      status,
      actorRole: 'delivery_partner',
      changedBy: userId,
    });
    return { ok: true };
  }

  async verifyDelivery(userId: string, type: OrderType, orderId: string, otp: string) {
    const partner = await this.requirePartner(userId);
    const order = await this.requireOwnActiveOrder(type, orderId, partner.id);
    if (order.status !== 'out_for_delivery') {
      throw new BadRequestException('Order must be out for delivery before it can be marked delivered');
    }
    if (!order.deliveryOtp || order.deliveryOtp !== otp) {
      throw new BadRequestException('Incorrect OTP');
    }

    const table = type === 'grocery' ? groceryOrders : foodOrders;
    await this.db.update(table).set({ status: 'delivered' }).where(eq(table.id, orderId));
    await this.db.insert(orderStatusHistory).values({
      ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
      status: 'delivered',
      actorRole: 'delivery_partner',
      changedBy: userId,
    });
    return { ok: true };
  }

  // ---------- Admin ----------

  async listPartnersBasic() {
    const rows = await this.db.select().from(deliveryPartners);
    const userIds = rows.map((r) => r.userId);
    const userRows = userIds.length ? await this.db.select().from(users).where(inArray(users.id, userIds)) : [];
    const phoneByUserId = new Map(userRows.map((u) => [u.id, u.phone]));
    // No delivery-partner "name" field exists anywhere (same phone-stands-in
    // pattern OrderService uses for customers/admins) — phone is the only
    // identifier the admin console has to work with.
    return rows.map((r) => ({ ...r, phone: phoneByUserId.get(r.userId) ?? '' }));
  }
}
