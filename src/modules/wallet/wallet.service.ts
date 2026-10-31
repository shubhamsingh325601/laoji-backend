import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomInt } from 'crypto';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  platformSettings,
  scratchCards,
  users,
  vendors,
  wallets,
  walletTransactions,
  withdrawalRequests,
} from '../../../drizzle/schema';
import type { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import type { AdjustWalletDto } from './dto/adjust-wallet.dto';
import type {
  AdjustScratchCardExpiryDto,
  AdjustWalletCreditExpiryDto,
  RestoreScratchCardDto,
  RestoreWalletCreditDto,
  UpdateExpirySettingsDto,
} from './dto/expiry-admin.dto';
import { NotificationService } from '../notification/notification.service';
import { walletAdjustedPush } from '../notification/templates/push/wallet-adjustment';
import { ensureReferralCode } from '../../common/utils/referral-code';

export const DEFAULT_REFERRAL_REWARD_PCT = 5;
export const DEFAULT_REFERRAL_REWARD_MAX = 15;
export const DEFAULT_SCRATCH_CARD_EXPIRY_DAYS = 15;
export const DEFAULT_WALLET_AMOUNT_EXPIRY_DAYS = 30;

/** Referrer's reward: pct% of the first order's item subtotal, capped at maxAmount, rounded to paise. */
export function calcReferralReward(orderSubtotal: number, pct: number, maxAmount = Infinity): number {
  if (!(orderSubtotal > 0) || !(pct > 0)) return 0;
  const reward = Math.round(((orderSubtotal * pct) / 100) * 100) / 100;
  return Math.min(reward, maxAmount);
}

@Injectable()
export class WalletService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly notifications: NotificationService,
  ) {}

  async onModuleInit() {
    // Process expirations on backend startup
    try {
      await this.processAllExpirations();
    } catch (err) {
      console.warn('[WalletService] Initial expiration sweep warning:', err);
    }

    // Schedule hourly sweep; unref so it won't hold the event loop open on shutdown
    const timer = setInterval(() => {
      this.processAllExpirations().catch((err) => {
        console.warn('[WalletService] Hourly expiration sweep warning:', err);
      });
    }, 1000 * 60 * 60);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  // ================= EXPIRY CONFIGURATION =================

  async getSettingNumber(key: string, fallback: number): Promise<number> {
    const [setting] = await this.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    const n = setting ? Number(setting.value) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** Default days before an unscratched scratch card expires (default 15). */
  async scratchCardExpiryDays(): Promise<number> {
    return this.getSettingNumber('scratch_card_unscratched_days', DEFAULT_SCRATCH_CARD_EXPIRY_DAYS);
  }

  /** Default days before customer wallet credits expire (default 30). */
  async walletAmountExpiryDays(): Promise<number> {
    return this.getSettingNumber('wallet_amount_expiry_days', DEFAULT_WALLET_AMOUNT_EXPIRY_DAYS);
  }

  async getExpirySettings() {
    return {
      scratchCardExpiryDays: await this.scratchCardExpiryDays(),
      walletAmountExpiryDays: await this.walletAmountExpiryDays(),
    };
  }

  async updateExpirySettings(dto: UpdateExpirySettingsDto) {
    if (dto.scratchCardExpiryDays < 1 || dto.walletAmountExpiryDays < 1) {
      throw new BadRequestException('Expiry days must be at least 1 day');
    }

    await this.db
      .insert(platformSettings)
      .values({
        key: 'scratch_card_unscratched_days',
        value: String(dto.scratchCardExpiryDays),
        description: 'Default days before an unscratched scratch card expires (default 15)',
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: String(dto.scratchCardExpiryDays) },
      });

    await this.db
      .insert(platformSettings)
      .values({
        key: 'wallet_amount_expiry_days',
        value: String(dto.walletAmountExpiryDays),
        description: 'Default days before customer wallet credits expire (default 30)',
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: String(dto.walletAmountExpiryDays) },
      });

    return {
      scratchCardExpiryDays: dto.scratchCardExpiryDays,
      walletAmountExpiryDays: dto.walletAmountExpiryDays,
    };
  }

  // ================= EXPIRY SWEEPER LOGIC =================

  /**
   * Expire scratch cards that haven't been scratched within their validity window (default 15 days).
   */
  async expireOldScratchCards(userId?: string): Promise<number> {
    const conditions: (SQL<unknown> | undefined)[] = [
      eq(scratchCards.status, 'unscratched'),
      isNotNull(scratchCards.expiresAt),
      lt(scratchCards.expiresAt, new Date()),
    ];
    if (userId) {
      conditions.push(eq(scratchCards.userId, userId));
    }

    const expired = await this.db
      .update(scratchCards)
      .set({
        status: 'expired',
        expiredAt: new Date(),
      })
      .where(and(...conditions))
      .returning({ id: scratchCards.id });

    return expired.length;
  }

  /**
   * Expire wallet amounts/credits whose validity window (default 30 days) has passed.
   * Deducts the remaining unspent portion from the user's wallet balance.
   */
  async expireOldWalletAmounts(userId?: string): Promise<{ expiredCount: number; totalExpiredAmount: number }> {
    const conditions: (SQL<unknown> | undefined)[] = [
      gt(walletTransactions.amount, 0),
      gt(walletTransactions.remainingAmount, 0),
      isNotNull(walletTransactions.expiresAt),
      lt(walletTransactions.expiresAt, new Date()),
      eq(walletTransactions.status, 'completed'),
      inArray(walletTransactions.type, [
        'scratch_card',
        'referral_bonus',
        'adjustment',
        'affiliate_commission',
        'order_refund',
        'restoration',
      ]),
    ];
    if (userId) {
      conditions.push(eq(walletTransactions.userId, userId));
    }

    const overdueList = await this.db
      .select()
      .from(walletTransactions)
      .where(and(...conditions));

    if (!overdueList.length) {
      return { expiredCount: 0, totalExpiredAmount: 0 };
    }

    let totalExpiredAmount = 0;

    for (const credit of overdueList) {
      const expAmt = Math.round((credit.remainingAmount ?? 0) * 100) / 100;
      if (expAmt <= 0) continue;

      await this.db.transaction(async (tx) => {
        // 1. Zero out remaining amount and record expiration timestamp
        await tx
          .update(walletTransactions)
          .set({
            remainingAmount: 0,
            expiredAt: new Date(),
          })
          .where(eq(walletTransactions.id, credit.id));

        // 2. Reduce wallet balance safely
        await tx
          .update(wallets)
          .set({
            balance: sql`GREATEST(0, ${wallets.balance} - ${expAmt})`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, credit.walletId));

        // 3. Insert audit expiry transaction
        await tx.insert(walletTransactions).values({
          walletId: credit.walletId,
          userId: credit.userId,
          amount: -expAmt,
          type: 'expiry',
          status: 'completed',
          description: `Wallet amount expired (${expAmt} ₹ from ${credit.type.replace('_', ' ')})`,
          orderId: credit.orderId,
          orderType: credit.orderType,
          metadata: {
            originalTxId: credit.id,
            originalType: credit.type,
            expiredAmount: expAmt,
            expiredAt: new Date().toISOString(),
          },
        });
      });

      totalExpiredAmount += expAmt;
    }

    return { expiredCount: overdueList.length, totalExpiredAmount };
  }

  /**
   * Run sweep for both scratch cards and wallet credits platform-wide.
   */
  async processAllExpirations() {
    const cardsExpired = await this.expireOldScratchCards();
    const walletRes = await this.expireOldWalletAmounts();
    return {
      scratchCardsExpired: cardsExpired,
      walletCreditsExpired: walletRes.expiredCount,
      totalWalletAmountExpired: walletRes.totalExpiredAmount,
    };
  }

  // ================= WALLET FIFO CONSUMPTION =================

  /**
   * Consume wallet credits using First-In-First-Out (FIFO) on earliest-expiring credits.
   */
  async deductWalletFifo(txDb: any, userId: string, debitAmount: number) {
    if (debitAmount <= 0) return;

    const activeCredits = await txDb
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          gt(walletTransactions.amount, 0),
          gt(walletTransactions.remainingAmount, 0),
          or(isNull(walletTransactions.expiresAt), gt(walletTransactions.expiresAt, new Date())),
        ),
      )
      .orderBy(asc(walletTransactions.expiresAt), asc(walletTransactions.createdAt));

    let needed = debitAmount;
    for (const credit of activeCredits) {
      if (needed <= 0) break;
      const currentRemaining = Number(credit.remainingAmount) || 0;
      const deductFromThis = Math.min(currentRemaining, needed);
      const newRemaining = Math.round((currentRemaining - deductFromThis) * 100) / 100;
      await txDb
        .update(walletTransactions)
        .set({ remainingAmount: newRemaining })
        .where(eq(walletTransactions.id, credit.id));
      needed = Math.round((needed - deductFromThis) * 100) / 100;
    }
  }

  /**
   * Debit customer wallet for checkout order payment with FIFO credit deduction.
   */
  async debitCustomerForOrder(customerId: string, maxAmount: number, orderId: string, orderType: 'grocery' | 'food') {
    await this.expireOldWalletAmounts(customerId);
    const wallet = await this.getOrCreateWallet(customerId);
    const amount = Math.min(Math.floor(wallet.balance * 100) / 100, maxAmount);
    if (amount <= 0) return 0;

    const result = await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} - ${amount}`, updatedAt: new Date() })
        .where(and(eq(wallets.id, wallet.id), sql`${wallets.balance} >= ${amount}`))
        .returning({ id: wallets.id });

      if (!updated.length) throw new BadRequestException('Wallet balance changed. Please try again.');

      await this.deductWalletFifo(tx, customerId, amount);

      const [txRow] = await tx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: customerId,
          amount,
          type: 'order_payment',
          status: 'completed',
          description: `Payment for ${orderType} order #${orderId.slice(0, 8).toUpperCase()}`,
          orderId,
          orderType,
        })
        .returning();

      return { amount, txRow };
    });

    return result.amount;
  }

  /**
   * Refund wallet portion when order payment fails or is cancelled.
   */
  async refundCustomerForOrder(customerId: string, amount: number, orderId: string, orderType: 'grocery' | 'food') {
    if (amount <= 0) return;
    const wallet = await this.getOrCreateWallet(customerId);
    const expiryDays = await this.walletAmountExpiryDays();
    const expiresAt = new Date(Date.now() + expiryDays * 86400000);

    await this.db.transaction(async (tx) => {
      await tx
        .update(wallets)
        .set({ balance: sql`${wallets.balance} + ${amount}`, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: customerId,
        amount,
        remainingAmount: amount,
        expiresAt,
        type: 'order_refund',
        status: 'completed',
        description: `Refund for ${orderType} order #${orderId.slice(0, 8).toUpperCase()}`,
        orderId,
        orderType,
        metadata: { validityDays: expiryDays },
      });
    });
  }

  // ================= WALLET SUMMARY & USER FUNCTIONS =================

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
   * Return full wallet summary including live balance, expiring credits, pending commissions, and history.
   */
  async getWalletSummary(userId: string) {
    await this.expireOldWalletAmounts(userId);
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

    // Calculate credits expiring soon (within next 7 days)
    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 86400000);
    const expiringSoonRows = await this.db
      .select({
        remainingAmount: walletTransactions.remainingAmount,
        expiresAt: walletTransactions.expiresAt,
      })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          gt(walletTransactions.remainingAmount, 0),
          gt(walletTransactions.expiresAt, now),
          lte(walletTransactions.expiresAt, in7Days),
        ),
      );

    const expiringSoon = expiringSoonRows.reduce((sum, r) => sum + (r.remainingAmount ?? 0), 0);

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
        expiringSoon: Math.round(expiringSoon * 100) / 100,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        remainingAmount: t.remainingAmount,
        expiresAt: t.expiresAt,
        expiredAt: t.expiredAt,
        restoredAt: t.restoredAt,
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

  // ================= AFFILIATE COMMISSIONS =================

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
    const expiryDays = await this.walletAmountExpiryDays();
    const expiresAt = new Date(Date.now() + expiryDays * 86400000);

    for (const tx of pendingTxList) {
      await this.db
        .update(walletTransactions)
        .set({
          status: 'completed',
          remainingAmount: tx.amount,
          expiresAt,
        })
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

  async restorePendingCommission(orderType: 'grocery' | 'food', orderId: string) {
    await this.db
      .update(walletTransactions)
      .set({ status: 'pending' })
      .where(
        and(
          eq(walletTransactions.orderId, orderId),
          eq(walletTransactions.type, 'affiliate_commission'),
          eq(walletTransactions.status, 'cancelled'),
        ),
      );
  }

  // ================= REFER & EARN =================

  private referralRewardPct(): Promise<number> {
    return this.getSettingNumber('referral_reward_pct', DEFAULT_REFERRAL_REWARD_PCT);
  }

  private referralRewardMax(): Promise<number> {
    return this.getSettingNumber('referral_reward_max_amount', DEFAULT_REFERRAL_REWARD_MAX);
  }

  async creditReferralReward(customerId: string, orderType: 'grocery' | 'food', orderId: string, orderSubtotal: number) {
    const [customer] = await this.db
      .select({
        referredBy: users.referredBy,
        referralRewardedAt: users.referralRewardedAt,
        name: users.name,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, customerId))
      .limit(1);
    if (!customer?.referredBy || customer.referralRewardedAt) return null;

    const pct = await this.referralRewardPct();
    const maxAmount = await this.referralRewardMax();
    const amount = calcReferralReward(orderSubtotal, pct, maxAmount);
    if (amount <= 0) return null;

    const referrerId = customer.referredBy;
    const wallet = await this.getOrCreateWallet(referrerId);
    const orderCode = orderId.slice(0, 8).toUpperCase();
    const expiryDays = await this.walletAmountExpiryDays();
    const expiresAt = new Date(Date.now() + expiryDays * 86400000);

    const credited = await this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(users)
        .set({ referralRewardedAt: new Date() })
        .where(and(eq(users.id, customerId), isNull(users.referralRewardedAt)))
        .returning({ id: users.id });
      if (!claimed) return false;

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId: referrerId,
        amount,
        remainingAmount: amount,
        expiresAt,
        type: 'referral_bonus',
        status: 'completed',
        description: `Referral bonus for your friend's first ${orderType} order #${orderCode}`,
        orderId,
        orderType,
        metadata: { referredUserId: customerId, pct, maxAmount, orderSubtotal, validityDays: expiryDays },
      });
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${amount}`,
          totalEarned: sql`${wallets.totalEarned} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
      return true;
    });
    if (!credited) return null;

    try {
      const summary = await this.getWalletSummary(referrerId);
      this.notifications.notifyPush(
        referrerId,
        'wallet_adjustment',
        walletAdjustedPush({
          action: 'credit',
          amount,
          newBalance: summary.wallet.balance,
          reason: 'Referral bonus',
          role: 'customer',
        }),
      );
    } catch {
      // Non-blocking
    }
    return { referrerId, amount };
  }

  async getReferralSummary(userId: string) {
    const code = await ensureReferralCode(this.db, userId);
    const rewardPct = await this.referralRewardPct();
    const rewardMax = await this.referralRewardMax();

    const referred = await this.db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        createdAt: users.createdAt,
        rewardedAt: users.referralRewardedAt,
      })
      .from(users)
      .where(eq(users.referredBy, userId))
      .orderBy(desc(users.createdAt))
      .limit(100);

    const bonuses = await this.db
      .select({ amount: walletTransactions.amount, metadata: walletTransactions.metadata })
      .from(walletTransactions)
      .where(and(eq(walletTransactions.userId, userId), eq(walletTransactions.type, 'referral_bonus')));

    const rewardByReferred = new Map<string, number>();
    let totalEarned = 0;
    for (const b of bonuses) {
      totalEarned += b.amount;
      const referredId = (b.metadata as { referredUserId?: string } | null)?.referredUserId;
      if (referredId) rewardByReferred.set(referredId, b.amount);
    }

    return {
      code,
      rewardPct,
      rewardMax,
      totalReferrals: referred.length,
      rewardedReferrals: referred.filter((r) => r.rewardedAt).length,
      totalEarned: Math.round(totalEarned * 100) / 100,
      referrals: referred.map((r) => ({
        id: r.id,
        name: r.name?.trim() || (r.phone ? `+91 ${r.phone.slice(0, 2)}••••••${r.phone.slice(-2)}` : 'Friend'),
        joinedAt: r.createdAt,
        status: r.rewardedAt ? ('rewarded' as const) : ('joined' as const),
        reward: rewardByReferred.get(r.id) ?? null,
      })),
    };
  }

  // ================= SCRATCH CARDS =================

  /**
   * Issue a scratch card for a delivered order.
   * Expires in 15 days (admin-configurable via platformSettings).
   */
  async issueScratchCard(userId: string, orderType: 'grocery' | 'food', orderId: string) {
    const validityDays = await this.scratchCardExpiryDays();
    const expiresAt = new Date(Date.now() + validityDays * 86400000);

    const [card] = await this.db
      .insert(scratchCards)
      .values({
        userId,
        orderType,
        orderId,
        status: 'unscratched',
        expiresAt,
      })
      .onConflictDoNothing()
      .returning();
    return card ?? null;
  }

  async listScratchCards(userId: string) {
    await this.expireOldScratchCards(userId);

    const rows = await this.db
      .select()
      .from(scratchCards)
      .where(eq(scratchCards.userId, userId))
      .orderBy(desc(scratchCards.createdAt))
      .limit(50);
    return rows.map((c) => this.toScratchCardView(c));
  }

  /**
   * Reveal a card: rolls ₹1–₹5 and credits it to the wallet.
   * Scratched card reward amount expires in 30 days.
   * If unscratched card is beyond its 15-day expiry date, it rejects as expired.
   */
  async scratchCard(userId: string, cardId: string) {
    await this.expireOldScratchCards(userId);
    const wallet = await this.getOrCreateWallet(userId);
    const walletExpiryDays = await this.walletAmountExpiryDays();
    const walletExpiresAt = new Date(Date.now() + walletExpiryDays * 86400000);

    const [targetCard] = await this.db
      .select()
      .from(scratchCards)
      .where(and(eq(scratchCards.id, cardId), eq(scratchCards.userId, userId)))
      .limit(1);

    if (!targetCard) throw new NotFoundException('Scratch card not found');
    if (
      targetCard.status === 'expired' ||
      (targetCard.status === 'unscratched' && targetCard.expiresAt && targetCard.expiresAt < new Date())
    ) {
      throw new BadRequestException('This scratch card has expired.');
    }

    const result = await this.db.transaction(async (tx) => {
      const amount = randomInt(1, 6);
      const [won] = await tx
        .update(scratchCards)
        .set({ status: 'scratched', amount, scratchedAt: new Date() })
        .where(
          and(
            eq(scratchCards.id, cardId),
            eq(scratchCards.userId, userId),
            eq(scratchCards.status, 'unscratched'),
            or(isNull(scratchCards.expiresAt), gt(scratchCards.expiresAt, new Date())),
          ),
        )
        .returning();

      if (!won) {
        const [existing] = await tx
          .select()
          .from(scratchCards)
          .where(and(eq(scratchCards.id, cardId), eq(scratchCards.userId, userId)))
          .limit(1);
        if (!existing) throw new NotFoundException('Scratch card not found');
        return { card: existing, justScratched: false };
      }

      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        userId,
        amount,
        remainingAmount: amount,
        expiresAt: walletExpiresAt,
        type: 'scratch_card',
        status: 'completed',
        description: `Scratch card reward for ${won.orderType} order #${won.orderId.slice(0, 8).toUpperCase()}`,
        orderId: won.orderId,
        orderType: won.orderType,
        metadata: { scratchCardId: won.id, validityDays: walletExpiryDays },
      });
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${amount}`,
          totalEarned: sql`${wallets.totalEarned} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
      return { card: won, justScratched: true };
    });

    const summary = await this.getWalletSummary(userId);
    return {
      ...this.toScratchCardView(result.card),
      justScratched: result.justScratched,
      walletBalance: summary.wallet.balance,
    };
  }

  toScratchCardView(c: typeof scratchCards.$inferSelect) {
    return {
      id: c.id,
      orderId: c.orderId,
      orderType: c.orderType as 'grocery' | 'food',
      status: c.status as 'unscratched' | 'scratched' | 'expired',
      amount: c.amount,
      scratchedAt: c.scratchedAt,
      expiresAt: c.expiresAt,
      expiredAt: c.expiredAt,
      restoredAt: c.restoredAt,
      adminNotes: c.adminNotes,
      createdAt: c.createdAt,
    };
  }

  // ================= WITHDRAWALS =================

  async requestWithdrawal(userId: string, dto: RequestWithdrawalDto) {
    await this.expireOldWalletAmounts(userId);
    const wallet = await this.getOrCreateWallet(userId);

    if (dto.amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than zero');
    }

    const [user] = await this.db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (user?.role === 'vendor') {
      const minLimit = await this.getSettingNumber('vendor_min_withdrawal_limit', 500);
      if (dto.amount < minLimit) {
        throw new BadRequestException(
          `Minimum withdrawal amount for vendors is ₹${minLimit}. You requested ₹${dto.amount}.`,
        );
      }
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

    // Deduct FIFO from remaining credits if user is a customer
    if (user?.role === 'customer') {
      await this.deductWalletFifo(this.db, userId, dto.amount);
    }

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

    await this.db
      .update(wallets)
      .set({
        totalWithdrawn: sql`${wallets.totalWithdrawn} + ${request.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, request.walletId));

    return updated;
  }

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

    await this.db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${request.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, request.walletId));

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

  async getUserWalletSummary(userId: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) throw new NotFoundException('User not found');

    const summary = await this.getWalletSummary(userId);

    let vendorInfo: { id: string; businessName: string; ownerName: string; type: string } | null = null;
    if (u.role === 'vendor') {
      const [v] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
      if (v) {
        vendorInfo = {
          id: v.id,
          businessName: v.businessName,
          ownerName: v.ownerName,
          type: v.type,
        };
      }
    }

    return {
      ...summary,
      user: {
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
        status: u.status,
      },
      vendor: vendorInfo,
    };
  }

  async getVendorWalletSummary(vendorId: string) {
    const [v] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!v) throw new NotFoundException('Vendor not found');

    const [u] = await this.db.select().from(users).where(eq(users.id, v.userId)).limit(1);
    const summary = await this.getWalletSummary(v.userId);

    return {
      ...summary,
      vendor: {
        id: v.id,
        businessName: v.businessName,
        ownerName: v.ownerName,
        type: v.type,
        shopAddress: v.shopAddress,
        userId: v.userId,
      },
      user: u
        ? {
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            role: u.role,
            status: u.status,
          }
        : null,
    };
  }

  /**
   * Admin adds or deducts money in a customer or vendor wallet.
   * Customer credits expire within 30 days (or custom validityDays passed).
   */
  async adjustWallet(dto: AdjustWalletDto, adminId?: string) {
    let targetUserId = dto.userId;

    if (!targetUserId && dto.vendorId) {
      const [v] = await this.db.select().from(vendors).where(eq(vendors.id, dto.vendorId)).limit(1);
      if (!v) throw new NotFoundException('Vendor not found');
      targetUserId = v.userId;
    }

    if (!targetUserId) {
      throw new BadRequestException('Either userId or vendorId must be provided');
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!user) throw new NotFoundException('User not found');

    const amount = Math.round(Number(dto.amount) * 100) / 100;
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Adjustment amount must be a positive number greater than 0');
    }

    const description = (dto.description || '').trim();
    if (!description) {
      throw new BadRequestException('Reason or description is required for wallet adjustment');
    }

    const wallet = await this.getOrCreateWallet(targetUserId);

    if (dto.action === 'debit') {
      const currentBalance = Math.round(wallet.balance * 100) / 100;
      if (currentBalance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance. Current balance is ₹${currentBalance}, cannot deduct ₹${amount}`,
        );
      }

      await this.db
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      if (user.role === 'customer') {
        await this.deductWalletFifo(this.db, targetUserId, amount);
      }

      const [tx] = await this.db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: targetUserId,
          amount: -amount,
          type: 'adjustment',
          status: 'completed',
          description,
          metadata: {
            action: 'debit',
            adminId: adminId ?? null,
            adjustedAt: new Date().toISOString(),
          },
        })
        .returning();

      const updatedSummary = await this.getWalletSummary(targetUserId);

      try {
        this.notifications.notifyPush(
          targetUserId,
          'wallet_adjustment',
          walletAdjustedPush({
            action: 'debit',
            amount,
            newBalance: updatedSummary.wallet.balance,
            reason: description,
            role: user.role,
          }),
        );
      } catch {
        // Non-blocking
      }

      return {
        success: true,
        message: `Successfully debited ₹${amount} from wallet`,
        transaction: tx,
        summary: updatedSummary,
      };
    } else {
      // Credit
      const expiryDays = dto.validityDays ?? (await this.walletAmountExpiryDays());
      const expiresAt = user.role === 'customer' ? new Date(Date.now() + expiryDays * 86400000) : null;
      const remainingAmount = user.role === 'customer' ? amount : null;

      await this.db
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${amount}`,
          totalEarned: sql`${wallets.totalEarned} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      const [tx] = await this.db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: targetUserId,
          amount,
          remainingAmount,
          expiresAt,
          type: 'adjustment',
          status: 'completed',
          description,
          metadata: {
            action: 'credit',
            adminId: adminId ?? null,
            validityDays: user.role === 'customer' ? expiryDays : null,
            adjustedAt: new Date().toISOString(),
          },
        })
        .returning();

      const updatedSummary = await this.getWalletSummary(targetUserId);

      try {
        this.notifications.notifyPush(
          targetUserId,
          'wallet_adjustment',
          walletAdjustedPush({
            action: 'credit',
            amount,
            newBalance: updatedSummary.wallet.balance,
            reason: description,
            role: user.role,
          }),
        );
      } catch {
        // Non-blocking
      }

      return {
        success: true,
        message: `Successfully credited ₹${amount} to wallet`,
        transaction: tx,
        summary: updatedSummary,
      };
    }
  }

  async listWallets(params: { role?: string; search?: string }) {
    const role = params.role && params.role !== 'all' ? params.role : undefined;

    const conditions: (SQL<unknown> | undefined)[] = [];
    if (role) {
      conditions.push(eq(users.role, role as any));
    } else {
      conditions.push(or(eq(users.role, 'customer'), eq(users.role, 'vendor')));
    }

    const rows = await this.db
      .select({
        walletId: wallets.id,
        userId: users.id,
        userName: users.name,
        userPhone: users.phone,
        userEmail: users.email,
        userRole: users.role,
        userStatus: users.status,
        userCreatedAt: users.createdAt,
        balance: sql<number>`coalesce(${wallets.balance}, 0)`,
        totalEarned: sql<number>`coalesce(${wallets.totalEarned}, 0)`,
        totalWithdrawn: sql<number>`coalesce(${wallets.totalWithdrawn}, 0)`,
        walletUpdatedAt: wallets.updatedAt,
        vendorId: vendors.id,
        businessName: vendors.businessName,
        vendorType: vendors.type,
      })
      .from(users)
      .leftJoin(wallets, eq(users.id, wallets.userId))
      .leftJoin(vendors, eq(users.id, vendors.userId))
      .where(and(...conditions))
      .orderBy(desc(wallets.balance), desc(users.createdAt));

    let filtered = rows;
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.userName && r.userName.toLowerCase().includes(q)) ||
          (r.userPhone && r.userPhone.includes(q)) ||
          (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
          (r.businessName && r.businessName.toLowerCase().includes(q)),
      );
    }

    return filtered.map((r) => ({
      walletId: r.walletId,
      userId: r.userId,
      userName:
        r.userName ||
        (r.userRole === 'customer'
          ? `Customer +91 ${r.userPhone ?? ''}`
          : `${r.businessName || 'Vendor'}`),
      userPhone: r.userPhone,
      userEmail: r.userEmail,
      userRole: r.userRole,
      userStatus: r.userStatus,
      balance: Math.round(Number(r.balance) * 100) / 100,
      totalEarned: Math.round(Number(r.totalEarned) * 100) / 100,
      totalWithdrawn: Math.round(Number(r.totalWithdrawn) * 100) / 100,
      vendorId: r.vendorId ?? null,
      businessName: r.businessName ?? null,
      vendorType: r.vendorType ?? null,
    }));
  }

  async listAllTransactions(limit = 100) {
    const rows = await this.db
      .select({
        id: walletTransactions.id,
        walletId: walletTransactions.walletId,
        userId: walletTransactions.userId,
        amount: walletTransactions.amount,
        remainingAmount: walletTransactions.remainingAmount,
        expiresAt: walletTransactions.expiresAt,
        expiredAt: walletTransactions.expiredAt,
        restoredAt: walletTransactions.restoredAt,
        type: walletTransactions.type,
        status: walletTransactions.status,
        description: walletTransactions.description,
        orderId: walletTransactions.orderId,
        orderType: walletTransactions.orderType,
        couponCode: walletTransactions.couponCode,
        metadata: walletTransactions.metadata,
        createdAt: walletTransactions.createdAt,
        userName: users.name,
        userPhone: users.phone,
        userRole: users.role,
        businessName: vendors.businessName,
        vendorId: vendors.id,
      })
      .from(walletTransactions)
      .innerJoin(users, eq(walletTransactions.userId, users.id))
      .leftJoin(vendors, eq(users.id, vendors.userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      walletId: r.walletId,
      userId: r.userId,
      amount: r.amount,
      remainingAmount: r.remainingAmount,
      expiresAt: r.expiresAt,
      expiredAt: r.expiredAt,
      restoredAt: r.restoredAt,
      type: r.type,
      status: r.status,
      description: r.description,
      orderId: r.orderId,
      orderType: r.orderType,
      couponCode: r.couponCode,
      metadata: r.metadata,
      createdAt: r.createdAt,
      userName:
        r.userName ||
        (r.userRole === 'customer'
          ? `Customer +91 ${r.userPhone ?? ''}`
          : `${r.businessName || 'Vendor'}`),
      userPhone: r.userPhone,
      userRole: r.userRole,
      businessName: r.businessName,
      vendorId: r.vendorId,
    }));
  }

  // ================= ADMIN SCRATCH CARDS MANAGEMENT =================

  /**
   * List all scratch cards with user and order info for admin review.
   */
  async listAllScratchCards(params: { userId?: string; status?: string; search?: string; limit?: number }) {
    await this.expireOldScratchCards();

    const conditions: (SQL<unknown> | undefined)[] = [];
    if (params.status && params.status !== 'all') {
      conditions.push(eq(scratchCards.status, params.status));
    }
    if (params.userId) {
      conditions.push(eq(scratchCards.userId, params.userId));
    }

    const rows = await this.db
      .select({
        id: scratchCards.id,
        userId: scratchCards.userId,
        orderId: scratchCards.orderId,
        orderType: scratchCards.orderType,
        status: scratchCards.status,
        amount: scratchCards.amount,
        scratchedAt: scratchCards.scratchedAt,
        expiresAt: scratchCards.expiresAt,
        expiredAt: scratchCards.expiredAt,
        restoredAt: scratchCards.restoredAt,
        adminNotes: scratchCards.adminNotes,
        createdAt: scratchCards.createdAt,
        userName: users.name,
        userPhone: users.phone,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(scratchCards)
      .innerJoin(users, eq(scratchCards.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(scratchCards.createdAt))
      .limit(params.limit ?? 100);

    let filtered = rows;
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.userName && r.userName.toLowerCase().includes(q)) ||
          (r.userPhone && r.userPhone.includes(q)) ||
          (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
          (r.orderId && r.orderId.toLowerCase().includes(q)),
      );
    }

    return filtered;
  }

  /**
   * Admin restores an expired scratch card for any customer.
   * Can customize validityDays (default 15).
   */
  async restoreScratchCard(cardId: string, dto: RestoreScratchCardDto) {
    const [card] = await this.db.select().from(scratchCards).where(eq(scratchCards.id, cardId)).limit(1);
    if (!card) throw new NotFoundException('Scratch card not found');

    const defaultDays = await this.scratchCardExpiryDays();
    const days = dto.validityDays && dto.validityDays > 0 ? dto.validityDays : defaultDays;
    const newExpiresAt = new Date(Date.now() + days * 86400000);

    const [updated] = await this.db
      .update(scratchCards)
      .set({
        status: 'unscratched',
        amount: null,
        scratchedAt: null,
        expiredAt: null,
        expiresAt: newExpiresAt,
        restoredAt: new Date(),
        adminNotes: dto.notes ?? `Restored by admin with ${days}-day validity`,
      })
      .where(eq(scratchCards.id, cardId))
      .returning();

    return this.toScratchCardView(updated);
  }

  /**
   * Admin extends or cuts the days of an active or expired scratch card.
   */
  async adjustScratchCardExpiry(cardId: string, dto: AdjustScratchCardExpiryDto) {
    const [card] = await this.db.select().from(scratchCards).where(eq(scratchCards.id, cardId)).limit(1);
    if (!card) throw new NotFoundException('Scratch card not found');

    let newExpiresAt: Date;
    if (dto.expiresAt) {
      newExpiresAt = new Date(dto.expiresAt);
    } else if (dto.validityDays && dto.validityDays > 0) {
      newExpiresAt = new Date(Date.now() + dto.validityDays * 86400000);
    } else {
      throw new BadRequestException('Either expiresAt or validityDays must be provided');
    }

    const updates: any = {
      expiresAt: newExpiresAt,
      adminNotes: dto.notes ?? `Validity adjusted by admin`,
    };

    // If card was expired and new date is in future, revive it
    if (card.status === 'expired' && newExpiresAt > new Date()) {
      updates.status = 'unscratched';
      updates.expiredAt = null;
      updates.restoredAt = new Date();
    } else if (card.status === 'unscratched' && newExpiresAt <= new Date()) {
      updates.status = 'expired';
      updates.expiredAt = new Date();
    }

    const [updated] = await this.db
      .update(scratchCards)
      .set(updates)
      .where(eq(scratchCards.id, cardId))
      .returning();

    return this.toScratchCardView(updated);
  }

  // ================= ADMIN CUSTOMER CREDITS & EXPIRY MANAGEMENT =================

  /**
   * Get all active and expired credit records for a customer.
   */
  async getCustomerCredits(userId: string) {
    await this.expireOldWalletAmounts(userId);

    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException('Customer not found');

    const wallet = await this.getOrCreateWallet(userId);

    const credits = await this.db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.userId, userId),
          or(
            gt(walletTransactions.amount, 0),
            eq(walletTransactions.type, 'expiry'),
          ),
        ),
      )
      .orderBy(desc(walletTransactions.createdAt))
      .limit(100);

    return {
      customer: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        walletBalance: wallet.balance,
      },
      credits: credits.map((c) => ({
        id: c.id,
        amount: c.amount,
        remainingAmount: c.remainingAmount,
        expiresAt: c.expiresAt,
        expiredAt: c.expiredAt,
        restoredAt: c.restoredAt,
        type: c.type,
        status: c.status,
        description: c.description,
        orderId: c.orderId,
        orderType: c.orderType,
        metadata: c.metadata,
        createdAt: c.createdAt,
        isExpired: Boolean(c.expiredAt || (c.expiresAt && new Date(c.expiresAt) < new Date() && (c.remainingAmount ?? 0) === 0)),
      })),
    };
  }

  /**
   * Admin restores an expired wallet amount for any customer.
   * Can extend or cut the restored days to less than 30 or more if needed.
   */
  async restoreWalletCredit(txId: string, dto: RestoreWalletCreditDto, adminId?: string) {
    const [tx] = await this.db.select().from(walletTransactions).where(eq(walletTransactions.id, txId)).limit(1);
    if (!tx) throw new NotFoundException('Transaction record not found');

    const defaultDays = await this.walletAmountExpiryDays();
    const days = dto.validityDays && dto.validityDays > 0 ? dto.validityDays : defaultDays;
    const newExpiresAt = new Date(Date.now() + days * 86400000);

    const restoreAmount = dto.amount && dto.amount > 0 ? Math.round(dto.amount * 100) / 100 : Math.abs(tx.amount);
    if (restoreAmount <= 0) {
      throw new BadRequestException('Restoration amount must be greater than zero');
    }

    const wallet = await this.getOrCreateWallet(tx.userId);

    const result = await this.db.transaction(async (trx) => {
      // 1. Credit wallet balance
      await trx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${restoreAmount}`,
          totalEarned: sql`${wallets.totalEarned} + ${restoreAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // 2. Insert restoration credit transaction with fresh expiry
      const [restoredTx] = await trx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: tx.userId,
          amount: restoreAmount,
          remainingAmount: restoreAmount,
          expiresAt: newExpiresAt,
          type: 'restoration',
          status: 'completed',
          description: dto.notes ?? `Restored expired wallet amount by admin (${days} days validity)`,
          orderId: tx.orderId,
          orderType: tx.orderType,
          metadata: {
            restoredFromTxId: tx.id,
            validityDays: days,
            adminId: adminId ?? null,
            restoredAt: new Date().toISOString(),
          },
        })
        .returning();

      // 3. Mark original transaction restored
      await trx
        .update(walletTransactions)
        .set({ restoredAt: new Date() })
        .where(eq(walletTransactions.id, tx.id));

      return restoredTx;
    });

    try {
      const summary = await this.getWalletSummary(tx.userId);
      this.notifications.notifyPush(
        tx.userId,
        'wallet_adjustment',
        walletAdjustedPush({
          action: 'credit',
          amount: restoreAmount,
          newBalance: summary.wallet.balance,
          reason: dto.notes || 'Restored expired wallet amount',
          role: 'customer',
        }),
      );
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      message: `Successfully restored ₹${restoreAmount} with ${days}-day validity`,
      transaction: result,
    };
  }

  /**
   * Admin extends or cuts the days of an active or expired wallet credit.
   */
  async adjustWalletCreditExpiry(txId: string, dto: AdjustWalletCreditExpiryDto) {
    const [tx] = await this.db.select().from(walletTransactions).where(eq(walletTransactions.id, txId)).limit(1);
    if (!tx) throw new NotFoundException('Transaction record not found');

    let newExpiresAt: Date;
    if (dto.expiresAt) {
      newExpiresAt = new Date(dto.expiresAt);
    } else if (dto.validityDays && dto.validityDays > 0) {
      newExpiresAt = new Date(Date.now() + dto.validityDays * 86400000);
    } else {
      throw new BadRequestException('Either expiresAt or validityDays must be provided');
    }

    const [updated] = await this.db
      .update(walletTransactions)
      .set({
        expiresAt: newExpiresAt,
        restoredAt: new Date(),
      })
      .where(eq(walletTransactions.id, txId))
      .returning();

    return updated;
  }
}
