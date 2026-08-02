import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { foodOrders, groceryOrders, payments, restaurants, users } from '../../../drizzle/schema';
import { UpiDeepLinkProvider } from './providers/upi-deeplink.provider';
import { CodProvider } from './providers/cod.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { RevenueConfigService } from '../revenue/revenue-config.service';
import type { PaymentProvider, PaymentStatus } from './payment.types';

type OrderType = 'grocery' | 'food';

// paymentStatus values that mean "the order can proceed" — paid outright,
// or COD (which is always fine at order time, collected only at delivery).
const PAYMENT_SATISFIED: PaymentStatus[] = ['paid', 'pending_cod', 'collected'];

@Injectable()
export class PaymentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly upi: UpiDeepLinkProvider,
    private readonly cod: CodProvider,
    private readonly razorpay: RazorpayProvider,
    private readonly revenueConfig: RevenueConfigService,
  ) {}

  private async vendorIdForOrder(type: OrderType, order: { vendorId?: string | null; restaurantId?: string }): Promise<string | null> {
    if (type === 'grocery') return order.vendorId ?? null;
    if (!order.restaurantId) return null;
    const [restaurant] = await this.db.select().from(restaurants).where(eq(restaurants.id, order.restaurantId)).limit(1);
    return restaurant?.vendorId ?? null;
  }

  isSatisfied(status: string | null | undefined): boolean {
    return PAYMENT_SATISFIED.includes(status as PaymentStatus);
  }

  private onlineProvider(): { provider: PaymentProvider; name: 'upi_deeplink' | 'razorpay' } {
    const selected = this.config.get<string>('PAYMENT_PROVIDER') as 'upi_deeplink' | 'razorpay';
    return selected === 'razorpay' ? { provider: this.razorpay, name: 'razorpay' } : { provider: this.upi, name: 'upi_deeplink' };
  }

  private orderTable(type: OrderType) {
    return type === 'grocery' ? groceryOrders : foodOrders;
  }

  private async requireOwnOrder(type: OrderType, orderId: string, customerId: string) {
    const table = this.orderTable(type);
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId) throw new ForbiddenException('Not your order');
    return order;
  }

  private async setOrderPaymentStatus(type: OrderType, orderId: string, status: PaymentStatus) {
    const table = this.orderTable(type);
    await this.db.update(table).set({ paymentStatus: status }).where(eq(table.id, orderId));
  }

  private async latestPayment(type: OrderType, orderId: string) {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(type === 'grocery' ? eq(payments.groceryOrderId, orderId) : eq(payments.foodOrderId, orderId))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return row ?? null;
  }

  async initiate(type: OrderType, orderId: string, customerId: string, method: 'online' | 'cod') {
    const order = await this.requireOwnOrder(type, orderId, customerId);

    const existing = await this.latestPayment(type, orderId);
    if (existing && existing.status !== 'failed') return existing;

    if (method === 'cod') {
      const vendorId = await this.vendorIdForOrder(type, order);
      const { codThreshold } = vendorId ? await this.revenueConfig.resolve(vendorId, null) : { codThreshold: null };
      if (codThreshold !== null && order.total > codThreshold) {
        throw new BadRequestException(`Cash on delivery isn't available for orders above ₹${codThreshold}`);
      }
    }

    const { provider, name } = method === 'cod' ? { provider: this.cod, name: 'cod' as const } : this.onlineProvider();
    const result = await provider.initiate({ orderId, amount: order.total });

    const [payment] = await this.db
      .insert(payments)
      .values({
        ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
        provider: name,
        status: result.status,
        amount: order.total,
        upiDeepLink: result.upiDeepLink,
        providerRef: result.providerRef,
      })
      .returning();

    await this.setOrderPaymentStatus(type, orderId, result.status);
    return payment;
  }

  async getForOrder(type: OrderType, orderId: string, customerId: string) {
    await this.requireOwnOrder(type, orderId, customerId);
    const payment = await this.latestPayment(type, orderId);
    if (!payment) throw new NotFoundException('No payment initiated for this order yet');
    return payment;
  }

  // Customer's "I've paid" happy-path self-confirmation — the only way a
  // UPI-deep-link-only flow (no PSP webhook) can ever reach `paid` without
  // an admin. Admin's manual reconciliation (below) is the fallback for
  // whenever this never happens (customer closes the app, disputes it, etc).
  async confirmByCustomer(type: OrderType, orderId: string, customerId: string) {
    await this.requireOwnOrder(type, orderId, customerId);
    const payment = await this.latestPayment(type, orderId);
    if (!payment) throw new NotFoundException('No payment initiated for this order yet');
    if (payment.provider === 'cod') {
      throw new BadRequestException('This order is cash on delivery — nothing to confirm online');
    }
    if (payment.status !== 'pending') {
      throw new BadRequestException(`Payment is already "${payment.status}" — nothing to confirm`);
    }

    const [updated] = await this.db
      .update(payments)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(payments.id, payment.id))
      .returning();
    await this.setOrderPaymentStatus(type, orderId, 'paid');
    return updated;
  }

  // Called by DeliveryService when a COD order's OTP-verified delivery
  // completes (Phase 5) — the only place COD ever resolves to `collected`.
  async markCodCollected(type: OrderType, orderId: string) {
    const payment = await this.latestPayment(type, orderId);
    if (!payment || payment.provider !== 'cod') return;
    await this.db.update(payments).set({ status: 'collected', updatedAt: new Date() }).where(eq(payments.id, payment.id));
    await this.setOrderPaymentStatus(type, orderId, 'collected');
  }

  // Called from wherever an order that had already reached `paid` (real
  // money moved) subsequently fails — allocation exhausted, vendor
  // rejects, or delivery assignment exhausts (Phase 5/6 housekeeping).
  // COD is deliberately excluded: nothing was ever collected if the order
  // fails before delivery, so there's nothing to refund. A no-op for any
  // payment not currently `paid` (e.g. still `pending`, or COD).
  async markRefundPendingIfPaid(type: OrderType, orderId: string) {
    const payment = await this.latestPayment(type, orderId);
    if (!payment || payment.status !== 'paid') return;
    await this.db.update(payments).set({ status: 'refund_pending', updatedAt: new Date() }).where(eq(payments.id, payment.id));
    await this.setOrderPaymentStatus(type, orderId, 'refund_pending');
  }

  // ---------- Admin: manual reconciliation ----------

  private async enrichForAdmin(rows: (typeof payments.$inferSelect)[]) {
    if (!rows.length) return [];

    const groceryIds = rows.filter((r) => r.groceryOrderId).map((r) => r.groceryOrderId!);
    const foodIds = rows.filter((r) => r.foodOrderId).map((r) => r.foodOrderId!);
    const groceryRows = groceryIds.length
      ? await this.db.select().from(groceryOrders).where(inArray(groceryOrders.id, groceryIds))
      : [];
    const foodRows = foodIds.length ? await this.db.select().from(foodOrders).where(inArray(foodOrders.id, foodIds)) : [];
    const groceryById = new Map(groceryRows.map((o) => [o.id, o]));
    const foodById = new Map(foodRows.map((o) => [o.id, o]));

    const customerIds = [...new Set([...groceryRows, ...foodRows].map((o) => o.customerId))];
    const customerRows = customerIds.length
      ? await this.db.select().from(users).where(inArray(users.id, customerIds))
      : [];
    const phoneByCustomerId = new Map(customerRows.map((u) => [u.id, u.phone ?? '']));

    return rows.map((r) => {
      const type: OrderType = r.groceryOrderId ? 'grocery' : 'food';
      const order = r.groceryOrderId ? groceryById.get(r.groceryOrderId) : foodById.get(r.foodOrderId!);
      return {
        id: r.id,
        type,
        orderId: (r.groceryOrderId ?? r.foodOrderId)!,
        orderCode: (r.groceryOrderId ?? r.foodOrderId)!.slice(0, 8).toUpperCase(),
        provider: r.provider,
        amount: r.amount,
        upiDeepLink: r.upiDeepLink,
        customerPhone: order ? (phoneByCustomerId.get(order.customerId) ?? '') : '',
        createdAt: r.createdAt,
      };
    });
  }

  async listPendingForAdmin() {
    const rows = await this.db.select().from(payments).where(eq(payments.status, 'pending'));
    return this.enrichForAdmin(rows);
  }

  async reconcile(paymentId: string, adminUserId: string, status: 'paid' | 'failed') {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'pending') {
      throw new BadRequestException(`Payment is already "${payment.status}" — nothing to reconcile`);
    }

    const [updated] = await this.db
      .update(payments)
      .set({ status, reconciledBy: adminUserId, reconciledAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning();

    const type: OrderType = payment.groceryOrderId ? 'grocery' : 'food';
    await this.setOrderPaymentStatus(type, (payment.groceryOrderId ?? payment.foodOrderId)!, status);
    return updated;
  }

  // ---------- Admin: refund queue ----------

  async listRefundsForAdmin() {
    const rows = await this.db.select().from(payments).where(eq(payments.status, 'refund_pending'));
    return this.enrichForAdmin(rows);
  }

  // Money movement itself happens outside the app (UPI/bank transfer) —
  // this just tracks that it happened, same "manual, not automated" shape
  // as pending-payment reconciliation.
  async markRefunded(paymentId: string, adminUserId: string) {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'refund_pending') {
      throw new BadRequestException(`Payment is "${payment.status}" — nothing to refund`);
    }

    const [updated] = await this.db
      .update(payments)
      .set({ status: 'refunded', reconciledBy: adminUserId, reconciledAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning();

    const type: OrderType = payment.groceryOrderId ? 'grocery' : 'food';
    await this.setOrderPaymentStatus(type, (payment.groceryOrderId ?? payment.foodOrderId)!, 'refunded');
    return updated;
  }
}
