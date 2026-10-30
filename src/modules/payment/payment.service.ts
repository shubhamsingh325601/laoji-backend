import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { foodOrders, groceryOrders, payments, restaurants, users, wallets, walletTransactions } from '../../../drizzle/schema';
import { UpiDeepLinkProvider } from './providers/upi-deeplink.provider';
import { CodProvider } from './providers/cod.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { RevenueConfigService } from '../revenue/revenue-config.service';
import { WalletService } from '../wallet/wallet.service';
import type { PaymentProvider, PaymentStatus } from './payment.types';

export type OrderType = 'grocery' | 'food';

export interface PaymentSatisfiedEvent {
  type: OrderType;
  orderId: string;
}

// paymentStatus values that mean "the order can proceed" — paid outright,
// or COD (which is always fine at order time, collected only at delivery).
const PAYMENT_SATISFIED: PaymentStatus[] = ['paid', 'pending_cod', 'collected'];

@Injectable()
export class PaymentService {
  private readonly paymentSatisfied$ = new Subject<PaymentSatisfiedEvent>();
  public readonly onPaymentSatisfied = this.paymentSatisfied$.asObservable();
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly upi: UpiDeepLinkProvider,
    private readonly cod: CodProvider,
    private readonly razorpay: RazorpayProvider,
    private readonly revenueConfig: RevenueConfigService,
    private readonly wallet: WalletService,
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

  private async setOrderPaymentStatus(
    type: OrderType,
    orderId: string,
    status: PaymentStatus,
    method?: string,
    walletAmount?: number,
  ) {
    const table = this.orderTable(type);
    await this.db
      .update(table)
      .set({
        paymentStatus: status,
        ...(method ? { paymentMethod: method } : {}),
        ...(walletAmount !== undefined ? { walletAmount } : {}),
      })
      .where(eq(table.id, orderId));
  }

  // Takes up to `maxAmount` out of the customer's wallet for this order and
  // returns what was actually taken (0 when the wallet is empty). The update
  // only succeeds while the balance still covers it, so two requests at once
  // can't overdraw the wallet.
  private async debitWalletForOrder(type: OrderType, orderId: string, customerId: string, maxAmount: number) {
    const wallet = await this.wallet.getOrCreateWallet(customerId);
    const amount = Math.min(Math.floor(wallet.balance * 100) / 100, maxAmount);
    if (amount <= 0) return 0;

    const updated = await this.db
      .update(wallets)
      .set({ balance: sql`${wallets.balance} - ${amount}`, updatedAt: new Date() })
      .where(and(eq(wallets.id, wallet.id), sql`${wallets.balance} >= ${amount}`))
      .returning({ id: wallets.id });
    if (!updated.length) throw new BadRequestException('Wallet balance changed. Please try again.');

    await this.db.insert(walletTransactions).values({
      walletId: wallet.id,
      userId: customerId,
      amount,
      type: 'order_payment',
      status: 'completed',
      description: `Payment for ${type} order #${orderId.slice(0, 8).toUpperCase()}`,
      orderId,
      orderType: type,
    });
    return amount;
  }

  // Puts back whatever the wallet still holds for this order (paid minus
  // already refunded) when a split payment's cash part doesn't go through.
  private async refundWalletPortion(type: OrderType, orderId: string, customerId: string) {
    const txs = await this.db
      .select({ type: walletTransactions.type, amount: walletTransactions.amount })
      .from(walletTransactions)
      .where(and(eq(walletTransactions.orderId, orderId), inArray(walletTransactions.type, ['order_payment', 'order_refund'])));
    const net = txs.reduce((sum, t) => sum + (t.type === 'order_payment' ? t.amount : -t.amount), 0);
    const amount = Math.round(net * 100) / 100;
    if (amount <= 0) return;

    const wallet = await this.wallet.getOrCreateWallet(customerId);
    await this.db
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}`, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));
    await this.db.insert(walletTransactions).values({
      walletId: wallet.id,
      userId: customerId,
      amount,
      type: 'order_refund',
      status: 'completed',
      description: `Refund for ${type} order #${orderId.slice(0, 8).toUpperCase()}`,
      orderId,
      orderType: type,
    });
    const table = this.orderTable(type);
    await this.db.update(table).set({ walletAmount: 0 }).where(eq(table.id, orderId));
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

  async initiate(type: OrderType, orderId: string, customerId: string, method: 'online' | 'cod' | 'wallet', useWallet = false) {
    const order = await this.requireOwnOrder(type, orderId, customerId);

    const existing = await this.latestPayment(type, orderId);
    if (existing && existing.status !== 'failed') {
      // Retrying the same way (e.g. reopening the UPI app) reuses the payment.
      // But a customer who backed out of the UPI app and now picks COD or the
      // wallet must get that instead — returning the still-pending UPI payment
      // left the order unpaid, so the vendor never saw it.
      const abandonedOnline =
        existing.status === 'pending' && existing.provider !== 'cod' && existing.provider !== ('wallet' as any) && method !== 'online';
      if (!abandonedOnline) return existing;

      // Only drops it while still pending, so a payment confirmed meanwhile wins.
      const dropped = await this.db
        .update(payments)
        .set({ status: 'failed' })
        .where(and(eq(payments.id, existing.id), eq(payments.status, 'pending')))
        .returning({ id: payments.id });
      if (!dropped.length) return (await this.latestPayment(type, orderId)) ?? existing;
      // Give back any wallet part taken for the abandoned attempt before paying again.
      await this.refundWalletPortion(type, orderId, customerId);
    }

    if (useWallet && method !== 'wallet') {
      const w = await this.wallet.getOrCreateWallet(customerId);
      // The wallet covers everything, so there is no second method to pay with.
      if (Math.round(w.balance * 100) / 100 >= order.total) method = 'wallet';
    }

    if (method === 'wallet') {
      const wallet = await this.wallet.getOrCreateWallet(customerId);
      const currentBalance = Math.round(wallet.balance * 100) / 100;
      if (currentBalance < order.total) {
        throw new BadRequestException(
          `Insufficient wallet balance. Available balance is ₹${currentBalance}, but order total is ₹${order.total}`,
        );
      }

      // Atomically deduct with a balance guard so two concurrent full-wallet
      // payments cannot both succeed and overdraw the balance.
      const deducted = await this.db
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${order.total}`,
          updatedAt: new Date(),
        })
        .where(and(eq(wallets.id, wallet.id), sql`${wallets.balance} >= ${order.total}`))
        .returning({ id: wallets.id });
      if (!deducted.length) {
        throw new BadRequestException('Wallet balance changed — please refresh and try again.');
      }

      const orderCode = orderId.slice(0, 8).toUpperCase();
      await this.db.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: customerId,
        amount: order.total,
        type: 'order_payment',
        status: 'completed',
        description: `Payment for ${type} order #${orderCode}`,
        orderId,
        orderType: type,
      });

      const [payment] = await this.db
        .insert(payments)
        .values({
          ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
          provider: 'wallet' as any,
          status: 'paid',
          amount: order.total,
          providerRef: orderId,
        })
        .returning();

      await this.setOrderPaymentStatus(type, orderId, 'paid', 'wallet', order.total);
      this.paymentSatisfied$.next({ type, orderId });
      return payment;
    }

    if (method === 'cod') {
      const vendorId = await this.vendorIdForOrder(type, order);
      const { codThreshold } = vendorId ? await this.revenueConfig.resolve(vendorId, null) : { codThreshold: null };
      if (codThreshold !== null && order.total > codThreshold) {
        throw new BadRequestException(`Cash on delivery isn't available for orders above ₹${codThreshold}`);
      }
    }

    // Split payment: take the wallet part first, then only the rest goes to UPI/COD.
    const walletUsed = useWallet ? await this.debitWalletForOrder(type, orderId, customerId, order.total) : 0;
    const payable = Math.round((order.total - walletUsed) * 100) / 100;

    const { provider, name } = method === 'cod' ? { provider: this.cod, name: 'cod' as const } : this.onlineProvider();
    let result: Awaited<ReturnType<typeof provider.initiate>>;
    try {
      result = await provider.initiate({ orderId, amount: payable });
    } catch (err) {
      if (walletUsed > 0) await this.refundWalletPortion(type, orderId, customerId);
      throw err;
    }

    const [payment] = await this.db
      .insert(payments)
      .values({
        ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
        provider: name,
        status: result.status,
        amount: payable,
        upiDeepLink: result.upiDeepLink,
        providerRef: result.providerRef,
      })
      .returning();

    await this.setOrderPaymentStatus(type, orderId, result.status, method === 'cod' ? 'cod' : 'upi', walletUsed);
    if (this.isSatisfied(result.status)) {
      this.paymentSatisfied$.next({ type, orderId });
    }
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
    await this.setOrderPaymentStatus(type, orderId, 'paid', 'upi');
    this.paymentSatisfied$.next({ type, orderId });
    return updated;
  }

  // Called by DeliveryService when a COD order's OTP-verified delivery
  // completes (Phase 5) — the only place COD ever resolves to `collected`.
  async markCodCollected(type: OrderType, orderId: string) {
    const payment = await this.latestPayment(type, orderId);
    if (!payment || payment.provider !== 'cod') return;
    await this.db.update(payments).set({ status: 'collected', updatedAt: new Date() }).where(eq(payments.id, payment.id));
    await this.setOrderPaymentStatus(type, orderId, 'collected', 'cod');
  }

  // Called from wherever an order that had already reached `paid` (real
  // money moved) subsequently fails — allocation exhausted, vendor
  // rejects, or delivery assignment exhausts (Phase 5/6 housekeeping).
  // COD is deliberately excluded: nothing was ever collected if the order
  // fails before delivery, so there's nothing to refund. A no-op for any
  // payment not currently `paid` (e.g. still `pending`, or COD).
  async markRefundPendingIfPaid(type: OrderType, orderId: string) {
    const payment = await this.latestPayment(type, orderId);
    if (!payment) return;

    // Split payment (wallet + UPI/COD): the wallet part goes straight back,
    // whether the cash part was paid, still pending, or is cash on delivery.
    if (payment.provider !== ('wallet' as any) && ['paid', 'pending', 'pending_cod'].includes(payment.status)) {
      const table = this.orderTable(type);
      const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
      if (order && order.walletAmount > 0) await this.refundWalletPortion(type, orderId, order.customerId);
    }
    if (payment.status !== 'paid') return;

    if (payment.provider === ('wallet' as any)) {
      // Automatic refund back to customer's wallet
      const table = this.orderTable(type);
      const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
      if (order) {
        const wallet = await this.wallet.getOrCreateWallet(order.customerId);
        await this.db
          .update(wallets)
          .set({
            balance: sql`${wallets.balance} + ${payment.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));

        await this.db.insert(walletTransactions).values({
          walletId: wallet.id,
          userId: order.customerId,
          amount: payment.amount,
          type: 'order_refund',
          status: 'completed',
          description: `Refund for cancelled ${type} order #${orderId.slice(0, 8).toUpperCase()}`,
          orderId,
          orderType: type,
        });
      }
      await this.db.update(payments).set({ status: 'refunded', updatedAt: new Date() }).where(eq(payments.id, payment.id));
      await this.setOrderPaymentStatus(type, orderId, 'refunded', 'wallet');
      return;
    }

    await this.db.update(payments).set({ status: 'refund_pending', updatedAt: new Date() }).where(eq(payments.id, payment.id));
    await this.setOrderPaymentStatus(type, orderId, 'refund_pending');
  }

  async restorePaymentStatusIfRestored(type: OrderType, orderId: string) {
    const payment = await this.latestPayment(type, orderId);
    if (payment && payment.status === 'refund_pending') {
      await this.db.update(payments).set({ status: 'paid', updatedAt: new Date() }).where(eq(payments.id, payment.id));
      await this.setOrderPaymentStatus(type, orderId, 'paid');
    }
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
    const orderId = (payment.groceryOrderId ?? payment.foodOrderId)!;
    await this.setOrderPaymentStatus(type, orderId, status);
    if (status === 'failed') {
      const table = this.orderTable(type);
      const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
      if (order && order.walletAmount > 0) await this.refundWalletPortion(type, orderId, order.customerId);
    }
    if (status === 'paid') {
      // Guard: don't fire paymentSatisfied$ if the order was already
      // cancelled or failed — it would create orphaned allocation rows and
      // phantom vendor push notifications.
      const table = this.orderTable(type);
      const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
      if (order && !['cancelled', 'failed'].includes(order.status)) {
        this.paymentSatisfied$.next({ type, orderId });
      }
    }
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
