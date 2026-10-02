import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { users, wallets, walletTransactions, withdrawalRequests } from '../../../drizzle/schema';
import type { RequestWithdrawalDto } from './dto/request-withdrawal.dto';

@Injectable()
export class WalletService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * Get or create a user's wallet.
   */
  async getOrCreateWallet(userId: string) {
    const [existing] = await this.db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    if (existing) return existing;

    const [created] = await this.db
      .insert(wallets)
      .values({
        userId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      })
      .onConflictDoNothing()
      .returning();

    if (created) return created;

    const [fallback] = await this.db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    return fallback;
  }

  /**
   * Return full wallet summary including live balance, pending commissions, and history.
   */
  async getWalletSummary(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const pendingRows = await this.db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          eq(walletTransactions.type, 'affiliate_commission'),
          eq(walletTransactions.status, 'pending'),
        ),
      );

    const pendingEarnings = pendingRows.reduce((sum, r) => sum + r.amount, 0);

    const transactions = await this.db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    const withdrawals = await this.db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(30);

    return {
      wallet: {
        id: wallet.id,
        balance: Math.round(wallet.balance * 100) / 100,
        totalEarned: Math.round(wallet.totalEarned * 100) / 100,
        totalWithdrawn: Math.round(wallet.totalWithdrawn * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        orderId: t.orderId,
        orderType: t.orderType,
        couponCode: t.couponCode,
        createdAt: t.createdAt,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount,
        payoutMethod: w.payoutMethod,
        upiId: w.upiId,
        bankAccount: w.bankAccount ? `•••• ${w.bankAccount.slice(-4)}` : null,
        bankIfsc: w.bankIfsc,
        status: w.status,
        adminNotes: w.adminNotes,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
      })),
    };
  }

  /**
   * Called when an order with an affiliate coupon is placed.
   * Creates a 'pending' transaction so the creator sees their upcoming earning immediately.
   */
  async recordPendingCommission(params: {
    userId: string;
    amount: number;
    orderId: string;
    orderType: 'grocery' | 'food';
    couponCode: string;
  }) {
    if (params.amount <= 0) return null;

    const wallet = await this.getOrCreateWallet(params.userId);
    const orderCode = params.orderId.slice(0, 8).toUpperCase();

    const [tx] = await this.db
      .insert(walletTransactions)
      .values({
        walletId: wallet.id,
        userId: params.userId,
        amount: Math.round(params.amount * 100) / 100,
        type: 'affiliate_commission',
        status: 'pending',
        description: `Affiliate referral commission for ${params.orderType} order #${orderCode} (Coupon: ${params.couponCode})`,
        orderId: params.orderId,
        orderType: params.orderType,
        couponCode: params.couponCode,
      })
      .returning();

    return tx;
  }

  /**
   * Called when the order is marked 'delivered' (or settled).
   * Transitions pending commission to 'completed' and credits the user's available balance!
   */
  async confirmCommissionOnDelivery(orderType: 'grocery' | 'food', orderId: string) {
    const pendingTxList = await this.db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.orderId, orderId),
          eq(walletTransactions.type, 'affiliate_commission'),
          eq(walletTransactions.status, 'pending'),
        ),
      );

    if (!pendingTxList.length) return;

    for (const tx of pendingTxList) {
      await this.db
        .update(walletTransactions)
        .set({ status: 'completed' })
        .where(eq(walletTransactions.id, tx.id));

      await this.db
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${tx.amount}`,
          totalEarned: sql`${wallets.totalEarned} + ${tx.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, tx.walletId));
    }
  }

  /**
   * Called if an order is cancelled or fails.
   * Marks any pending commission for this order as cancelled.
   */
  async cancelPendingCommission(orderType: 'grocery' | 'food', orderId: string) {
    await this.db
      .update(walletTransactions)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(walletTransactions.orderId, orderId),
          eq(walletTransactions.type, 'affiliate_commission'),
          eq(walletTransactions.status, 'pending'),
        ),
      );
  }

  /**
   * User requests a payout/withdrawal from their available balance.
   */
  async requestWithdrawal(userId: string, dto: RequestWithdrawalDto) {
    const wallet = await this.getOrCreateWallet(userId);

    if (dto.amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than zero');
    }

    if (wallet.balance < dto.amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. You requested ₹${dto.amount}, but your available balance is ₹${wallet.balance}`,
      );
    }

    if (dto.payoutMethod === 'upi' && !dto.upiId?.trim()) {
      throw new BadRequestException('Please provide a valid UPI ID (e.g. yourname@upi)');
    }

    if (dto.payoutMethod === 'bank' && (!dto.bankAccount?.trim() || !dto.bankIfsc?.trim())) {
      throw new BadRequestException('Please provide your Bank Account number and IFSC code');
    }

    // 1. Deduct immediately from available balance
    await this.db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${dto.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    // 2. Insert withdrawal request
    const [request] = await this.db
      .insert(withdrawalRequests)
      .values({
        userId,
        walletId: wallet.id,
        amount: dto.amount,
        payoutMethod: dto.payoutMethod,
        upiId: dto.upiId?.trim() || null,
        bankAccount: dto.bankAccount?.trim() || null,
        bankIfsc: dto.bankIfsc?.trim().toUpperCase() || null,
        accountHolderName: dto.accountHolderName?.trim() || null,
        status: 'pending',
      })
      .returning();

    // 3. Record pending debit transaction
    const dest = dto.payoutMethod === 'upi' ? `UPI: ${dto.upiId}` : `Bank: •••• ${dto.bankAccount?.slice(-4)}`;
    await this.db.insert(walletTransactions).values({
      walletId: wallet.id,
      userId,
      amount: -dto.amount,
      type: 'withdrawal',
      status: 'pending',
      description: `Withdrawal request to ${dest}`,
      metadata: { withdrawalRequestId: request.id },
    });

    return {
      success: true,
      message: `Withdrawal request of ₹${dto.amount} submitted successfully. Funds will be transferred within 24 hours.`,
      request,
    };
  }

  // ================= ADMIN FUNCTIONS =================

  /**
   * List all withdrawal requests for admin review.
   */
  async listAllWithdrawalRequests(status?: string) {
    const condition = status ? eq(withdrawalRequests.status, status) : undefined;

    const rows = await this.db
      .select({
        id: withdrawalRequests.id,
        userId: withdrawalRequests.userId,
        walletId: withdrawalRequests.walletId,
        amount: withdrawalRequests.amount,
        payoutMethod: withdrawalRequests.payoutMethod,
        upiId: withdrawalRequests.upiId,
        bankAccount: withdrawalRequests.bankAccount,
        bankIfsc: withdrawalRequests.bankIfsc,
        accountHolderName: withdrawalRequests.accountHolderName,
        status: withdrawalRequests.status,
        adminNotes: withdrawalRequests.adminNotes,
        processedAt: withdrawalRequests.processedAt,
        createdAt: withdrawalRequests.createdAt,
        userName: users.name,
        userPhone: users.phone,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(withdrawalRequests)
      .leftJoin(users, eq(withdrawalRequests.userId, users.id))
      .where(condition)
      .orderBy(desc(withdrawalRequests.createdAt));

    return rows;
  }

  /**
   * Admin approves a withdrawal request after initiating or completing bank/UPI transfer.
   */
  async approveWithdrawal(requestId: string, adminNotes?: string) {
    const [request] = await this.db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, requestId))
      .limit(1);

    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException(`Withdrawal request is already ${request.status}`);
    }

    const [updated] = await this.db
      .update(withdrawalRequests)
      .set({
        status: 'approved',
        adminNotes: adminNotes ?? request.adminNotes,
        processedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, requestId))
      .returning();

    // Mark the pending debit transaction as completed
    await this.db
      .update(walletTransactions)
      .set({ status: 'completed' })
      .where(
        and(
          eq(walletTransactions.userId, request.userId),
          eq(walletTransactions.type, 'withdrawal'),
          eq(walletTransactions.status, 'pending'),
          sql`${walletTransactions.metadata}->>'withdrawalRequestId' = ${requestId}`,
        ),
      );

    // Update totalWithdrawn in wallet
    await this.db
      .update(wallets)
      .set({
        totalWithdrawn: sql`${wallets.totalWithdrawn} + ${request.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, request.walletId));

    return updated;
  }

  /**
   * Admin rejects a withdrawal request and refunds the money back to the user's wallet.
   */
  async rejectWithdrawal(requestId: string, adminNotes?: string) {
    const [request] = await this.db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, requestId))
      .limit(1);

    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException(`Withdrawal request is already ${request.status}`);
    }

    const [updated] = await this.db
      .update(withdrawalRequests)
      .set({
        status: 'rejected',
        adminNotes: adminNotes ?? 'Rejected by administrator',
        processedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, requestId))
      .returning();

    // Refund the amount back to user's wallet
    await this.db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${request.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, request.walletId));

    // Mark the pending debit transaction as rejected
    await this.db
      .update(walletTransactions)
      .set({
        status: 'rejected',
        description: sql`concat(${walletTransactions.description}, ' (Rejected: ', ${adminNotes || 'Declined'}, ')')`,
      })
      .where(
        and(
          eq(walletTransactions.userId, request.userId),
          eq(walletTransactions.type, 'withdrawal'),
          eq(walletTransactions.status, 'pending'),
          sql`${walletTransactions.metadata}->>'withdrawalRequestId' = ${requestId}`,
        ),
      );

    return updated;
  }
}
