import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  foodOrders,
  groceryOrders,
  orderStatusHistory,
  restaurants,
  settlements,
  users,
  vendors,
  vendorWithdrawals,
  platformSettings,
} from '../../../drizzle/schema';
import { NotificationService } from '../notification/notification.service';
import {
  withdrawalApprovedVendorPush,
  withdrawalRejectedVendorPush,
  withdrawalRequestedAdminPush,
} from '../notification/templates/push/vendor-withdrawal';

type OrderType = 'grocery' | 'food';
type WithdrawalRow = typeof vendorWithdrawals.$inferSelect;

export const DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT = 500;
export const PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL = 'vendor_min_withdrawal_limit';

const round2 = (n: number) => Math.round(n * 100) / 100;

const orderCode = (id: string) => id.slice(0, 8).toUpperCase();

/**
 * Vendor payout requests. The vendor's balance is derived, never stored:
 *   available = sum(settlements.vendor_payout) - approved - pending
 * A pending request holds its amount back, so a vendor can't request the same
 * money twice, and rejecting simply releases it. Admin sends the money by hand.
 */
@Injectable()
export class VendorWithdrawalService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly notifications: NotificationService,
  ) {}

  // ---------- Balance ----------

  private async totalEarned(vendorId: string): Promise<number> {
    const total = sql<number>`coalesce(sum(${settlements.vendorPayout}), 0)`;
    const [[grocery], [food]] = await Promise.all([
      this.db
        .select({ total })
        .from(settlements)
        .innerJoin(groceryOrders, eq(settlements.groceryOrderId, groceryOrders.id))
        .where(eq(groceryOrders.vendorId, vendorId)),
      this.db
        .select({ total })
        .from(settlements)
        .innerJoin(foodOrders, eq(settlements.foodOrderId, foodOrders.id))
        .innerJoin(restaurants, eq(foodOrders.restaurantId, restaurants.id))
        .where(eq(restaurants.vendorId, vendorId)),
    ]);
    return Number(grocery?.total ?? 0) + Number(food?.total ?? 0);
  }

  async getBalance(vendorId: string) {
    const [totalEarned, byStatus] = await Promise.all([
      this.totalEarned(vendorId),
      this.db
        .select({
          status: vendorWithdrawals.status,
          total: sql<number>`coalesce(sum(${vendorWithdrawals.amount}), 0)`,
        })
        .from(vendorWithdrawals)
        .where(eq(vendorWithdrawals.vendorId, vendorId))
        .groupBy(vendorWithdrawals.status),
    ]);
    const sumFor = (status: string) => Number(byStatus.find((r) => r.status === status)?.total ?? 0);
    const totalWithdrawn = sumFor('approved');
    const pendingAmount = sumFor('pending');
    return {
      availableBalance: Math.max(0, round2(totalEarned - totalWithdrawn - pendingAmount)),
      totalEarned: round2(totalEarned),
      totalWithdrawn: round2(totalWithdrawn),
      pendingAmount: round2(pendingAmount),
    };
  }

  // ---------- Vendor ----------

  // ---------- Platform Policy & Settings ----------

  async getMinWithdrawalLimit(): Promise<number> {
    const [row] = await this.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL))
      .limit(1);

    if (!row || !row.value) return DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT;
    const parsed = Number(row.value);
    return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT;
  }

  async updateMinWithdrawalLimit(
    limit: number,
    adminId?: string,
  ): Promise<{ minWithdrawalLimit: number; message: string }> {
    const val = round2(Number(limit));
    if (!Number.isFinite(val) || val < 1) {
      throw new BadRequestException('Minimum withdrawal limit must be at least ₹1.');
    }

    await this.db
      .insert(platformSettings)
      .values({
        key: PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL,
        value: String(val),
        description: 'Minimum withdrawal limit for vendors in INR',
        updatedAt: new Date(),
        updatedBy: adminId || null,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: String(val),
          updatedAt: new Date(),
          updatedBy: adminId || null,
        },
      });

    return {
      minWithdrawalLimit: val,
      message: `Minimum withdrawal limit updated to ₹${val}`,
    };
  }

  async getWithdrawalSettings() {
    const minWithdrawalLimit = await this.getMinWithdrawalLimit();
    return { minWithdrawalLimit };
  }

  // ---------- Vendor ----------

  private async vendorForUser(userId: string) {
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor profile not set up yet');
    return vendor;
  }

  async listForVendor(userId: string) {
    const vendor = await this.vendorForUser(userId);
    const [balance, rows, minWithdrawalLimit] = await Promise.all([
      this.getBalance(vendor.id),
      this.db
        .select()
        .from(vendorWithdrawals)
        .where(eq(vendorWithdrawals.vendorId, vendor.id))
        .orderBy(desc(vendorWithdrawals.createdAt))
        .limit(50),
      this.getMinWithdrawalLimit(),
    ]);
    return {
      ...balance,
      minWithdrawalLimit,
      hasPending: rows.some((r) => r.status === 'pending'),
      withdrawals: rows.map((w) => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        payoutMethod: w.payoutMethod,
        // Never send the full account number back to the app.
        payoutDestination: w.upiId ?? (w.bankAccount ? `•••• ${w.bankAccount.slice(-4)}` : null),
        rejectionReason: w.rejectionReason,
        payoutReference: w.payoutReference,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
      })),
    };
  }

  async request(userId: string, requested?: number) {
    const vendor = await this.vendorForUser(userId);

    if (vendor.kycStatus !== 'verified') {
      throw new BadRequestException(
        'KYC verification required before withdrawal. Please upload your Aadhaar card (front and back) to complete verification.',
      );
    }
    if (!vendor.bankAccount && !vendor.upiId) {
      throw new BadRequestException(
        'Please add your Bank Account or UPI ID before requesting a withdrawal so we know where to send your funds.',
      );
    }

    const [open] = await this.db
      .select({ id: vendorWithdrawals.id })
      .from(vendorWithdrawals)
      .where(and(eq(vendorWithdrawals.vendorId, vendor.id), eq(vendorWithdrawals.status, 'pending')))
      .limit(1);
    if (open) {
      throw new ConflictException('You already have a withdrawal request waiting for approval.');
    }

    const [{ availableBalance }, minLimit] = await Promise.all([
      this.getBalance(vendor.id),
      this.getMinWithdrawalLimit(),
    ]);
    if (availableBalance <= 0) {
      throw new BadRequestException('You do not have any balance to withdraw.');
    }
    if (availableBalance < minLimit) {
      throw new BadRequestException(
        `Minimum withdrawal limit is ₹${minLimit}. Your current available balance is ₹${availableBalance}.`,
      );
    }
    const amount = requested === undefined ? availableBalance : round2(requested);
    if (amount <= 0) throw new BadRequestException('Withdrawal amount must be greater than zero.');
    if (amount < minLimit) {
      throw new BadRequestException(
        `Minimum withdrawal amount is ₹${minLimit}. You requested ₹${amount}.`,
      );
    }
    if (amount > availableBalance) {
      throw new BadRequestException(
        `You can withdraw at most ₹${availableBalance}. You asked for ₹${amount}.`,
      );
    }


    // This request covers everything since the last *approved* one.
    const [lastApproved] = await this.db
      .select({ periodEnd: vendorWithdrawals.periodEnd })
      .from(vendorWithdrawals)
      .where(and(eq(vendorWithdrawals.vendorId, vendor.id), eq(vendorWithdrawals.status, 'approved')))
      .orderBy(desc(vendorWithdrawals.periodEnd))
      .limit(1);

    const usesUpi = !!vendor.upiId;
    let created: WithdrawalRow;
    try {
      [created] = await this.db
        .insert(vendorWithdrawals)
        .values({
          vendorId: vendor.id,
          amount,
          availableBefore: availableBalance,
          payoutMethod: usesUpi ? 'upi' : 'bank',
          upiId: usesUpi ? vendor.upiId : null,
          bankAccount: usesUpi ? null : vendor.bankAccount,
          bankIfsc: usesUpi ? null : vendor.bankIfsc,
          periodStart: lastApproved?.periodEnd ?? null,
          periodEnd: new Date(),
        })
        .returning();
    } catch (err: any) {
      // Two taps at once: the one-pending-per-vendor index rejects the second.
      if (err?.code === '23505') {
        throw new ConflictException('You already have a withdrawal request waiting for approval.');
      }
      throw err;
    }

    this.notifications.notifyAllAdminsPush(
      'withdrawal_requested',
      withdrawalRequestedAdminPush(vendor.businessName, amount, created.id),
    );

    const destination = usesUpi
      ? `UPI ID (${vendor.upiId})`
      : `Bank Account (•••• ${vendor.bankAccount?.slice(-4) ?? ''}, IFSC: ${vendor.bankIfsc ?? 'N/A'})`;
    return {
      success: true,
      message: `Withdrawal request of ₹${amount} submitted. Once approved, it will be sent to your registered ${destination}.`,
      withdrawalId: created.id,
      amount,
      availableBalance: round2(availableBalance - amount),
    };
  }

  // ---------- Admin ----------

  async listForAdmin(status?: string) {
    const rows = await this.db
      .select({
        w: vendorWithdrawals,
        businessName: vendors.businessName,
        ownerName: vendors.ownerName,
        vendorPhone: users.phone,
      })
      .from(vendorWithdrawals)
      .innerJoin(vendors, eq(vendorWithdrawals.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(status ? eq(vendorWithdrawals.status, status) : undefined)
      .orderBy(desc(vendorWithdrawals.createdAt))
      .limit(200);

    return rows.map(({ w, businessName, ownerName, vendorPhone }) => ({
      ...this.toAdminSummary(w),
      vendor: { id: w.vendorId, businessName, ownerName, phone: vendorPhone },
    }));
  }

  async getForAdmin(id: string) {
    const [row] = await this.db
      .select({
        w: vendorWithdrawals,
        businessName: vendors.businessName,
        ownerName: vendors.ownerName,
        vendorPhone: users.phone,
      })
      .from(vendorWithdrawals)
      .innerJoin(vendors, eq(vendorWithdrawals.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendorWithdrawals.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Withdrawal request not found');
    const { w } = row;

    const orders = await this.ordersInPeriod(w.vendorId, w.periodStart, w.periodEnd);
    const delivered = orders.filter((o) => o.status === 'delivered');
    const lost = orders.filter((o) => o.status !== 'delivered');
    const periodNet = round2(delivered.reduce((sum, o) => sum + o.vendorPayout, 0));

    return {
      ...this.toAdminSummary(w),
      vendor: { id: w.vendorId, businessName: row.businessName, ownerName: row.ownerName, phone: row.vendorPhone },
      payout: { method: w.payoutMethod, upiId: w.upiId, bankAccount: w.bankAccount, bankIfsc: w.bankIfsc },
      summary: {
        delivered: {
          count: delivered.length,
          sales: round2(delivered.reduce((sum, o) => sum + o.subtotal, 0)),
          commission: round2(delivered.reduce((sum, o) => sum + o.commission, 0)),
          net: periodNet,
        },
        cancelled: {
          count: lost.length,
          value: round2(lost.reduce((sum, o) => sum + o.subtotal, 0)),
        },
        // Balance left over from earlier periods (a vendor can withdraw less than the full balance).
        carriedOver: round2(w.availableBefore - periodNet),
        availableBefore: w.availableBefore,
        requested: w.amount,
        remainingAfter: round2(w.availableBefore - w.amount),
      },
      orders,
    };
  }

  async approve(id: string, adminId: string, payoutReference?: string) {
    const [updated] = await this.db
      .update(vendorWithdrawals)
      .set({
        status: 'approved',
        processedBy: adminId,
        processedAt: new Date(),
        payoutReference: payoutReference?.trim() || null,
      })
      .where(and(eq(vendorWithdrawals.id, id), eq(vendorWithdrawals.status, 'pending')))
      .returning();
    if (!updated) await this.throwNotPending(id);

    await this.notifyVendor(updated.vendorId, (userId) =>
      this.notifications.notifyPush(userId, 'withdrawal_approved', withdrawalApprovedVendorPush(updated.amount)),
    );
    return this.toAdminSummary(updated);
  }

  async reject(id: string, adminId: string, reason: string) {
    const [updated] = await this.db
      .update(vendorWithdrawals)
      .set({
        status: 'rejected',
        processedBy: adminId,
        processedAt: new Date(),
        rejectionReason: reason,
      })
      .where(and(eq(vendorWithdrawals.id, id), eq(vendorWithdrawals.status, 'pending')))
      .returning();
    if (!updated) await this.throwNotPending(id);

    await this.notifyVendor(updated.vendorId, (userId) =>
      this.notifications.notifyPush(userId, 'withdrawal_rejected', withdrawalRejectedVendorPush(updated.amount, reason)),
    );
    return this.toAdminSummary(updated);
  }

  // ---------- Internals ----------

  private async throwNotPending(id: string): Promise<never> {
    const [existing] = await this.db
      .select({ status: vendorWithdrawals.status })
      .from(vendorWithdrawals)
      .where(eq(vendorWithdrawals.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Withdrawal request not found');
    throw new ConflictException(`This withdrawal request is already ${existing.status}.`);
  }

  private async notifyVendor(vendorId: string, send: (userId: string) => void) {
    const [vendor] = await this.db
      .select({ userId: vendors.userId })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);
    if (vendor) send(vendor.userId);
  }

  private toAdminSummary(w: WithdrawalRow) {
    return {
      id: w.id,
      status: w.status,
      amount: w.amount,
      availableBefore: w.availableBefore,
      payoutMethod: w.payoutMethod,
      payoutDestination: w.upiId ?? w.bankAccount,
      periodStart: w.periodStart,
      periodEnd: w.periodEnd,
      rejectionReason: w.rejectionReason,
      payoutReference: w.payoutReference,
      processedAt: w.processedAt,
      createdAt: w.createdAt,
    };
  }

  /**
   * Every order of this vendor that finished in (start, end]: delivered ones
   * (with the settlement money) and cancelled/failed ones (no payout).
   * Settlements are written once and never edited, so this gives the same
   * answer whenever it is read.
   */
  private async ordersInPeriod(vendorId: string, start: Date | null, end: Date) {
    const inRange = (column: Parameters<typeof gt>[0]): SQL[] => [
      ...(start ? [gt(column, start)] : []),
      lte(column, end),
    ];

    const settlementFields = {
      payout: settlements.vendorPayout,
      commission: settlements.platformShare,
      settledAt: settlements.createdAt,
    };
    const orderFields = (t: typeof groceryOrders | typeof foodOrders) => ({
      id: t.id,
      subtotal: t.subtotal,
      total: t.total,
      paymentStatus: t.paymentStatus,
      status: t.status,
      createdAt: t.createdAt,
    });

    const [groceryDone, foodDone] = await Promise.all([
      this.db
        .select({ ...settlementFields, order: orderFields(groceryOrders) })
        .from(settlements)
        .innerJoin(groceryOrders, eq(settlements.groceryOrderId, groceryOrders.id))
        .where(and(eq(groceryOrders.vendorId, vendorId), ...inRange(settlements.createdAt))),
      this.db
        .select({ ...settlementFields, order: orderFields(foodOrders) })
        .from(settlements)
        .innerJoin(foodOrders, eq(settlements.foodOrderId, foodOrders.id))
        .innerJoin(restaurants, eq(foodOrders.restaurantId, restaurants.id))
        .where(and(eq(restaurants.vendorId, vendorId), ...inRange(settlements.createdAt))),
    ]);

    const delivered = [
      ...groceryDone.map((r) => ({ ...r, type: 'grocery' as OrderType })),
      ...foodDone.map((r) => ({ ...r, type: 'food' as OrderType })),
    ].map((r) => ({
      type: r.type,
      orderId: r.order.id,
      orderCode: orderCode(r.order.id),
      status: 'delivered' as const,
      at: r.settledAt,
      subtotal: r.order.subtotal,
      orderTotal: r.order.total,
      commission: r.commission,
      vendorPayout: r.payout,
      paymentStatus: r.order.paymentStatus,
    }));

    const [groceryLost, foodLost] = await Promise.all([
      this.db
        .select(orderFields(groceryOrders))
        .from(groceryOrders)
        .where(and(eq(groceryOrders.vendorId, vendorId), inArray(groceryOrders.status, ['cancelled', 'failed']))),
      this.db
        .select(orderFields(foodOrders))
        .from(foodOrders)
        .innerJoin(restaurants, eq(foodOrders.restaurantId, restaurants.id))
        .where(and(eq(restaurants.vendorId, vendorId), inArray(foodOrders.status, ['cancelled', 'failed']))),
    ]);

    const endedAt = await this.terminalTimes(groceryLost.map((o) => o.id), foodLost.map((o) => o.id));
    const lost = [
      ...groceryLost.map((o) => ({ ...o, type: 'grocery' as OrderType })),
      ...foodLost.map((o) => ({ ...o, type: 'food' as OrderType })),
    ]
      .map((o) => ({ o, at: endedAt.get(o.id) ?? o.createdAt }))
      .filter(({ at }) => (!start || at > start) && at <= end)
      .map(({ o, at }) => ({
        type: o.type,
        orderId: o.id,
        orderCode: orderCode(o.id),
        status: o.status as 'cancelled' | 'failed',
        at,
        subtotal: o.subtotal,
        orderTotal: o.total,
        commission: 0,
        vendorPayout: 0,
        paymentStatus: o.paymentStatus,
      }));

    return [...delivered, ...lost].sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  /** When each cancelled/failed order reached that status, from order_status_history. */
  private async terminalTimes(groceryIds: string[], foodIds: string[]) {
    const times = new Map<string, Date>();
    const terminal = inArray(orderStatusHistory.status, ['cancelled', 'failed']);
    const [g, f] = await Promise.all([
      groceryIds.length
        ? this.db
            .select({ id: orderStatusHistory.groceryOrderId, at: orderStatusHistory.changedAt })
            .from(orderStatusHistory)
            .where(and(inArray(orderStatusHistory.groceryOrderId, groceryIds), terminal))
        : [],
      foodIds.length
        ? this.db
            .select({ id: orderStatusHistory.foodOrderId, at: orderStatusHistory.changedAt })
            .from(orderStatusHistory)
            .where(and(inArray(orderStatusHistory.foodOrderId, foodIds), terminal))
        : [],
    ]);
    for (const { id, at } of [...g, ...f]) {
      if (id && (!times.has(id) || at > times.get(id)!)) times.set(id, at);
    }
    return times;
  }
}
