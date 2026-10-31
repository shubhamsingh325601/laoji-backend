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
exports.WalletService = exports.DEFAULT_WALLET_AMOUNT_EXPIRY_DAYS = exports.DEFAULT_SCRATCH_CARD_EXPIRY_DAYS = exports.DEFAULT_REFERRAL_REWARD_MAX = exports.DEFAULT_REFERRAL_REWARD_PCT = void 0;
exports.calcReferralReward = calcReferralReward;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const notification_service_1 = require("../notification/notification.service");
const wallet_adjustment_1 = require("../notification/templates/push/wallet-adjustment");
const referral_code_1 = require("../../common/utils/referral-code");
exports.DEFAULT_REFERRAL_REWARD_PCT = 5;
exports.DEFAULT_REFERRAL_REWARD_MAX = 15;
exports.DEFAULT_SCRATCH_CARD_EXPIRY_DAYS = 15;
exports.DEFAULT_WALLET_AMOUNT_EXPIRY_DAYS = 30;
function calcReferralReward(orderSubtotal, pct, maxAmount = Infinity) {
    if (!(orderSubtotal > 0) || !(pct > 0))
        return 0;
    const reward = Math.round(((orderSubtotal * pct) / 100) * 100) / 100;
    return Math.min(reward, maxAmount);
}
let WalletService = class WalletService {
    db;
    notifications;
    constructor(db, notifications) {
        this.db = db;
        this.notifications = notifications;
    }
    async onModuleInit() {
        try {
            await this.processAllExpirations();
        }
        catch (err) {
            console.warn('[WalletService] Initial expiration sweep warning:', err);
        }
        const timer = setInterval(() => {
            this.processAllExpirations().catch((err) => {
                console.warn('[WalletService] Hourly expiration sweep warning:', err);
            });
        }, 1000 * 60 * 60);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }
    async getSettingNumber(key, fallback) {
        const [setting] = await this.db
            .select({ value: schema_1.platformSettings.value })
            .from(schema_1.platformSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.platformSettings.key, key))
            .limit(1);
        const n = setting ? Number(setting.value) : NaN;
        return Number.isFinite(n) && n > 0 ? n : fallback;
    }
    async scratchCardExpiryDays() {
        return this.getSettingNumber('scratch_card_unscratched_days', exports.DEFAULT_SCRATCH_CARD_EXPIRY_DAYS);
    }
    async walletAmountExpiryDays() {
        return this.getSettingNumber('wallet_amount_expiry_days', exports.DEFAULT_WALLET_AMOUNT_EXPIRY_DAYS);
    }
    async getExpirySettings() {
        return {
            scratchCardExpiryDays: await this.scratchCardExpiryDays(),
            walletAmountExpiryDays: await this.walletAmountExpiryDays(),
        };
    }
    async updateExpirySettings(dto) {
        if (dto.scratchCardExpiryDays < 1 || dto.walletAmountExpiryDays < 1) {
            throw new common_1.BadRequestException('Expiry days must be at least 1 day');
        }
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: 'scratch_card_unscratched_days',
            value: String(dto.scratchCardExpiryDays),
            description: 'Default days before an unscratched scratch card expires (default 15)',
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: { value: String(dto.scratchCardExpiryDays) },
        });
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: 'wallet_amount_expiry_days',
            value: String(dto.walletAmountExpiryDays),
            description: 'Default days before customer wallet credits expire (default 30)',
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: { value: String(dto.walletAmountExpiryDays) },
        });
        return {
            scratchCardExpiryDays: dto.scratchCardExpiryDays,
            walletAmountExpiryDays: dto.walletAmountExpiryDays,
        };
    }
    async expireOldScratchCards(userId) {
        const conditions = [
            (0, drizzle_orm_1.eq)(schema_1.scratchCards.status, 'unscratched'),
            (0, drizzle_orm_1.isNotNull)(schema_1.scratchCards.expiresAt),
            (0, drizzle_orm_1.lt)(schema_1.scratchCards.expiresAt, new Date()),
        ];
        if (userId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, userId));
        }
        const expired = await this.db
            .update(schema_1.scratchCards)
            .set({
            status: 'expired',
            expiredAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)(...conditions))
            .returning({ id: schema_1.scratchCards.id });
        return expired.length;
    }
    async expireOldWalletAmounts(userId) {
        const conditions = [
            (0, drizzle_orm_1.gt)(schema_1.walletTransactions.amount, 0),
            (0, drizzle_orm_1.gt)(schema_1.walletTransactions.remainingAmount, 0),
            (0, drizzle_orm_1.isNotNull)(schema_1.walletTransactions.expiresAt),
            (0, drizzle_orm_1.lt)(schema_1.walletTransactions.expiresAt, new Date()),
            (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'completed'),
            (0, drizzle_orm_1.inArray)(schema_1.walletTransactions.type, [
                'scratch_card',
                'referral_bonus',
                'adjustment',
                'affiliate_commission',
                'order_refund',
                'restoration',
            ]),
        ];
        if (userId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId));
        }
        const overdueList = await this.db
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)(...conditions));
        if (!overdueList.length) {
            return { expiredCount: 0, totalExpiredAmount: 0 };
        }
        let totalExpiredAmount = 0;
        for (const credit of overdueList) {
            const expAmt = Math.round((credit.remainingAmount ?? 0) * 100) / 100;
            if (expAmt <= 0)
                continue;
            await this.db.transaction(async (tx) => {
                await tx
                    .update(schema_1.walletTransactions)
                    .set({
                    remainingAmount: 0,
                    expiredAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, credit.id));
                await tx
                    .update(schema_1.wallets)
                    .set({
                    balance: (0, drizzle_orm_1.sql) `GREATEST(0, ${schema_1.wallets.balance} - ${expAmt})`,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, credit.walletId));
                await tx.insert(schema_1.walletTransactions).values({
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
    async processAllExpirations() {
        const cardsExpired = await this.expireOldScratchCards();
        const walletRes = await this.expireOldWalletAmounts();
        return {
            scratchCardsExpired: cardsExpired,
            walletCreditsExpired: walletRes.expiredCount,
            totalWalletAmountExpired: walletRes.totalExpiredAmount,
        };
    }
    async deductWalletFifo(txDb, userId, debitAmount) {
        if (debitAmount <= 0)
            return;
        const activeCredits = await txDb
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId), (0, drizzle_orm_1.gt)(schema_1.walletTransactions.amount, 0), (0, drizzle_orm_1.gt)(schema_1.walletTransactions.remainingAmount, 0), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.walletTransactions.expiresAt), (0, drizzle_orm_1.gt)(schema_1.walletTransactions.expiresAt, new Date()))))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.walletTransactions.expiresAt), (0, drizzle_orm_1.asc)(schema_1.walletTransactions.createdAt));
        let needed = debitAmount;
        for (const credit of activeCredits) {
            if (needed <= 0)
                break;
            const currentRemaining = Number(credit.remainingAmount) || 0;
            const deductFromThis = Math.min(currentRemaining, needed);
            const newRemaining = Math.round((currentRemaining - deductFromThis) * 100) / 100;
            await txDb
                .update(schema_1.walletTransactions)
                .set({ remainingAmount: newRemaining })
                .where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, credit.id));
            needed = Math.round((needed - deductFromThis) * 100) / 100;
        }
    }
    async debitCustomerForOrder(customerId, maxAmount, orderId, orderType) {
        await this.expireOldWalletAmounts(customerId);
        const wallet = await this.getOrCreateWallet(customerId);
        const amount = Math.min(Math.floor(wallet.balance * 100) / 100, maxAmount);
        if (amount <= 0)
            return 0;
        const result = await this.db.transaction(async (tx) => {
            const updated = await tx
                .update(schema_1.wallets)
                .set({ balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} - ${amount}`, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id), (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} >= ${amount}`))
                .returning({ id: schema_1.wallets.id });
            if (!updated.length)
                throw new common_1.BadRequestException('Wallet balance changed. Please try again.');
            await this.deductWalletFifo(tx, customerId, amount);
            const [txRow] = await tx
                .insert(schema_1.walletTransactions)
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
    async refundCustomerForOrder(customerId, amount, orderId, orderType) {
        if (amount <= 0)
            return;
        const wallet = await this.getOrCreateWallet(customerId);
        const expiryDays = await this.walletAmountExpiryDays();
        const expiresAt = new Date(Date.now() + expiryDays * 86400000);
        await this.db.transaction(async (tx) => {
            await tx
                .update(schema_1.wallets)
                .set({ balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${amount}`, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
            await tx.insert(schema_1.walletTransactions).values({
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
    async getOrCreateWallet(userId) {
        const [existing] = await this.db.select().from(schema_1.wallets).where((0, drizzle_orm_1.eq)(schema_1.wallets.userId, userId)).limit(1);
        if (existing)
            return existing;
        const [created] = await this.db
            .insert(schema_1.wallets)
            .values({
            userId,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
        })
            .onConflictDoNothing()
            .returning();
        if (created)
            return created;
        const [fallback] = await this.db.select().from(schema_1.wallets).where((0, drizzle_orm_1.eq)(schema_1.wallets.userId, userId)).limit(1);
        return fallback;
    }
    async getWalletSummary(userId) {
        await this.expireOldWalletAmounts(userId);
        const wallet = await this.getOrCreateWallet(userId);
        const pendingRows = await this.db
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'affiliate_commission'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'pending')));
        const pendingEarnings = pendingRows.reduce((sum, r) => sum + r.amount, 0);
        const now = new Date();
        const in7Days = new Date(Date.now() + 7 * 86400000);
        const expiringSoonRows = await this.db
            .select({
            remainingAmount: schema_1.walletTransactions.remainingAmount,
            expiresAt: schema_1.walletTransactions.expiresAt,
        })
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId), (0, drizzle_orm_1.gt)(schema_1.walletTransactions.remainingAmount, 0), (0, drizzle_orm_1.gt)(schema_1.walletTransactions.expiresAt, now), (0, drizzle_orm_1.lte)(schema_1.walletTransactions.expiresAt, in7Days)));
        const expiringSoon = expiringSoonRows.reduce((sum, r) => sum + (r.remainingAmount ?? 0), 0);
        const transactions = await this.db
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.walletTransactions.createdAt))
            .limit(50);
        const withdrawals = await this.db
            .select()
            .from(schema_1.withdrawalRequests)
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.withdrawalRequests.createdAt))
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
    async recordPendingCommission(params) {
        if (params.amount <= 0)
            return null;
        const wallet = await this.getOrCreateWallet(params.userId);
        const orderCode = params.orderId.slice(0, 8).toUpperCase();
        const [tx] = await this.db
            .insert(schema_1.walletTransactions)
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
    async confirmCommissionOnDelivery(orderType, orderId) {
        const pendingTxList = await this.db
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.orderId, orderId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'affiliate_commission'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'pending')));
        if (!pendingTxList.length)
            return;
        const expiryDays = await this.walletAmountExpiryDays();
        const expiresAt = new Date(Date.now() + expiryDays * 86400000);
        for (const tx of pendingTxList) {
            await this.db
                .update(schema_1.walletTransactions)
                .set({
                status: 'completed',
                remainingAmount: tx.amount,
                expiresAt,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, tx.id));
            await this.db
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${tx.amount}`,
                totalEarned: (0, drizzle_orm_1.sql) `${schema_1.wallets.totalEarned} + ${tx.amount}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, tx.walletId));
        }
    }
    async cancelPendingCommission(orderType, orderId) {
        await this.db
            .update(schema_1.walletTransactions)
            .set({ status: 'cancelled' })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.orderId, orderId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'affiliate_commission'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'pending')));
    }
    async restorePendingCommission(orderType, orderId) {
        await this.db
            .update(schema_1.walletTransactions)
            .set({ status: 'pending' })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.orderId, orderId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'affiliate_commission'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'cancelled')));
    }
    referralRewardPct() {
        return this.getSettingNumber('referral_reward_pct', exports.DEFAULT_REFERRAL_REWARD_PCT);
    }
    referralRewardMax() {
        return this.getSettingNumber('referral_reward_max_amount', exports.DEFAULT_REFERRAL_REWARD_MAX);
    }
    async creditReferralReward(customerId, orderType, orderId, orderSubtotal) {
        const [customer] = await this.db
            .select({
            referredBy: schema_1.users.referredBy,
            referralRewardedAt: schema_1.users.referralRewardedAt,
            name: schema_1.users.name,
            phone: schema_1.users.phone,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, customerId))
            .limit(1);
        if (!customer?.referredBy || customer.referralRewardedAt)
            return null;
        const pct = await this.referralRewardPct();
        const maxAmount = await this.referralRewardMax();
        const amount = calcReferralReward(orderSubtotal, pct, maxAmount);
        if (amount <= 0)
            return null;
        const referrerId = customer.referredBy;
        const wallet = await this.getOrCreateWallet(referrerId);
        const orderCode = orderId.slice(0, 8).toUpperCase();
        const expiryDays = await this.walletAmountExpiryDays();
        const expiresAt = new Date(Date.now() + expiryDays * 86400000);
        const credited = await this.db.transaction(async (tx) => {
            const [claimed] = await tx
                .update(schema_1.users)
                .set({ referralRewardedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.id, customerId), (0, drizzle_orm_1.isNull)(schema_1.users.referralRewardedAt)))
                .returning({ id: schema_1.users.id });
            if (!claimed)
                return false;
            await tx.insert(schema_1.walletTransactions).values({
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
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${amount}`,
                totalEarned: (0, drizzle_orm_1.sql) `${schema_1.wallets.totalEarned} + ${amount}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
            return true;
        });
        if (!credited)
            return null;
        try {
            const summary = await this.getWalletSummary(referrerId);
            this.notifications.notifyPush(referrerId, 'wallet_adjustment', (0, wallet_adjustment_1.walletAdjustedPush)({
                action: 'credit',
                amount,
                newBalance: summary.wallet.balance,
                reason: 'Referral bonus',
                role: 'customer',
            }));
        }
        catch {
        }
        return { referrerId, amount };
    }
    async getReferralSummary(userId) {
        const code = await (0, referral_code_1.ensureReferralCode)(this.db, userId);
        const rewardPct = await this.referralRewardPct();
        const rewardMax = await this.referralRewardMax();
        const referred = await this.db
            .select({
            id: schema_1.users.id,
            name: schema_1.users.name,
            phone: schema_1.users.phone,
            createdAt: schema_1.users.createdAt,
            rewardedAt: schema_1.users.referralRewardedAt,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.referredBy, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt))
            .limit(100);
        const bonuses = await this.db
            .select({ amount: schema_1.walletTransactions.amount, metadata: schema_1.walletTransactions.metadata })
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'referral_bonus')));
        const rewardByReferred = new Map();
        let totalEarned = 0;
        for (const b of bonuses) {
            totalEarned += b.amount;
            const referredId = b.metadata?.referredUserId;
            if (referredId)
                rewardByReferred.set(referredId, b.amount);
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
                status: r.rewardedAt ? 'rewarded' : 'joined',
                reward: rewardByReferred.get(r.id) ?? null,
            })),
        };
    }
    async issueScratchCard(userId, orderType, orderId) {
        const validityDays = await this.scratchCardExpiryDays();
        const expiresAt = new Date(Date.now() + validityDays * 86400000);
        const [card] = await this.db
            .insert(schema_1.scratchCards)
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
    async listScratchCards(userId) {
        await this.expireOldScratchCards(userId);
        const rows = await this.db
            .select()
            .from(schema_1.scratchCards)
            .where((0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.scratchCards.createdAt))
            .limit(50);
        return rows.map((c) => this.toScratchCardView(c));
    }
    async scratchCard(userId, cardId) {
        await this.expireOldScratchCards(userId);
        const wallet = await this.getOrCreateWallet(userId);
        const walletExpiryDays = await this.walletAmountExpiryDays();
        const walletExpiresAt = new Date(Date.now() + walletExpiryDays * 86400000);
        const [targetCard] = await this.db
            .select()
            .from(schema_1.scratchCards)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId), (0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, userId)))
            .limit(1);
        if (!targetCard)
            throw new common_1.NotFoundException('Scratch card not found');
        if (targetCard.status === 'expired' ||
            (targetCard.status === 'unscratched' && targetCard.expiresAt && targetCard.expiresAt < new Date())) {
            throw new common_1.BadRequestException('This scratch card has expired.');
        }
        const result = await this.db.transaction(async (tx) => {
            const amount = (0, crypto_1.randomInt)(1, 6);
            const [won] = await tx
                .update(schema_1.scratchCards)
                .set({ status: 'scratched', amount, scratchedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId), (0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, userId), (0, drizzle_orm_1.eq)(schema_1.scratchCards.status, 'unscratched'), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_1.scratchCards.expiresAt), (0, drizzle_orm_1.gt)(schema_1.scratchCards.expiresAt, new Date()))))
                .returning();
            if (!won) {
                const [existing] = await tx
                    .select()
                    .from(schema_1.scratchCards)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId), (0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, userId)))
                    .limit(1);
                if (!existing)
                    throw new common_1.NotFoundException('Scratch card not found');
                return { card: existing, justScratched: false };
            }
            await tx.insert(schema_1.walletTransactions).values({
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
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${amount}`,
                totalEarned: (0, drizzle_orm_1.sql) `${schema_1.wallets.totalEarned} + ${amount}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
            return { card: won, justScratched: true };
        });
        const summary = await this.getWalletSummary(userId);
        return {
            ...this.toScratchCardView(result.card),
            justScratched: result.justScratched,
            walletBalance: summary.wallet.balance,
        };
    }
    toScratchCardView(c) {
        return {
            id: c.id,
            orderId: c.orderId,
            orderType: c.orderType,
            status: c.status,
            amount: c.amount,
            scratchedAt: c.scratchedAt,
            expiresAt: c.expiresAt,
            expiredAt: c.expiredAt,
            restoredAt: c.restoredAt,
            adminNotes: c.adminNotes,
            createdAt: c.createdAt,
        };
    }
    async requestWithdrawal(userId, dto) {
        await this.expireOldWalletAmounts(userId);
        const wallet = await this.getOrCreateWallet(userId);
        if (dto.amount <= 0) {
            throw new common_1.BadRequestException('Withdrawal amount must be greater than zero');
        }
        const [user] = await this.db.select({ role: schema_1.users.role }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (user?.role === 'vendor') {
            const minLimit = await this.getSettingNumber('vendor_min_withdrawal_limit', 500);
            if (dto.amount < minLimit) {
                throw new common_1.BadRequestException(`Minimum withdrawal amount for vendors is ₹${minLimit}. You requested ₹${dto.amount}.`);
            }
        }
        if (wallet.balance < dto.amount) {
            throw new common_1.BadRequestException(`Insufficient wallet balance. You requested ₹${dto.amount}, but your available balance is ₹${wallet.balance}`);
        }
        if (dto.payoutMethod === 'upi' && !dto.upiId?.trim()) {
            throw new common_1.BadRequestException('Please provide a valid UPI ID (e.g. yourname@upi)');
        }
        if (dto.payoutMethod === 'bank' && (!dto.bankAccount?.trim() || !dto.bankIfsc?.trim())) {
            throw new common_1.BadRequestException('Please provide your Bank Account number and IFSC code');
        }
        await this.db
            .update(schema_1.wallets)
            .set({
            balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} - ${dto.amount}`,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
        if (user?.role === 'customer') {
            await this.deductWalletFifo(this.db, userId, dto.amount);
        }
        const [request] = await this.db
            .insert(schema_1.withdrawalRequests)
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
        const dest = dto.payoutMethod === 'upi' ? `UPI: ${dto.upiId}` : `Bank: •••• ${dto.bankAccount?.slice(-4)}`;
        await this.db.insert(schema_1.walletTransactions).values({
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
    async listAllWithdrawalRequests(status) {
        const condition = status ? (0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.status, status) : undefined;
        const rows = await this.db
            .select({
            id: schema_1.withdrawalRequests.id,
            userId: schema_1.withdrawalRequests.userId,
            walletId: schema_1.withdrawalRequests.walletId,
            amount: schema_1.withdrawalRequests.amount,
            payoutMethod: schema_1.withdrawalRequests.payoutMethod,
            upiId: schema_1.withdrawalRequests.upiId,
            bankAccount: schema_1.withdrawalRequests.bankAccount,
            bankIfsc: schema_1.withdrawalRequests.bankIfsc,
            accountHolderName: schema_1.withdrawalRequests.accountHolderName,
            status: schema_1.withdrawalRequests.status,
            adminNotes: schema_1.withdrawalRequests.adminNotes,
            processedAt: schema_1.withdrawalRequests.processedAt,
            createdAt: schema_1.withdrawalRequests.createdAt,
            userName: schema_1.users.name,
            userPhone: schema_1.users.phone,
            userEmail: schema_1.users.email,
            userRole: schema_1.users.role,
        })
            .from(schema_1.withdrawalRequests)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.userId, schema_1.users.id))
            .where(condition)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.withdrawalRequests.createdAt));
        return rows;
    }
    async approveWithdrawal(requestId, adminNotes) {
        const [request] = await this.db
            .select()
            .from(schema_1.withdrawalRequests)
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.id, requestId))
            .limit(1);
        if (!request)
            throw new common_1.NotFoundException('Withdrawal request not found');
        if (request.status !== 'pending') {
            throw new common_1.BadRequestException(`Withdrawal request is already ${request.status}`);
        }
        const [updated] = await this.db
            .update(schema_1.withdrawalRequests)
            .set({
            status: 'approved',
            adminNotes: adminNotes ?? request.adminNotes,
            processedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.id, requestId))
            .returning();
        await this.db
            .update(schema_1.walletTransactions)
            .set({ status: 'completed' })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, request.userId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'withdrawal'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'pending'), (0, drizzle_orm_1.sql) `${schema_1.walletTransactions.metadata}->>'withdrawalRequestId' = ${requestId}`));
        await this.db
            .update(schema_1.wallets)
            .set({
            totalWithdrawn: (0, drizzle_orm_1.sql) `${schema_1.wallets.totalWithdrawn} + ${request.amount}`,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, request.walletId));
        return updated;
    }
    async rejectWithdrawal(requestId, adminNotes) {
        const [request] = await this.db
            .select()
            .from(schema_1.withdrawalRequests)
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.id, requestId))
            .limit(1);
        if (!request)
            throw new common_1.NotFoundException('Withdrawal request not found');
        if (request.status !== 'pending') {
            throw new common_1.BadRequestException(`Withdrawal request is already ${request.status}`);
        }
        const [updated] = await this.db
            .update(schema_1.withdrawalRequests)
            .set({
            status: 'rejected',
            adminNotes: adminNotes ?? 'Rejected by administrator',
            processedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.withdrawalRequests.id, requestId))
            .returning();
        await this.db
            .update(schema_1.wallets)
            .set({
            balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${request.amount}`,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, request.walletId));
        await this.db
            .update(schema_1.walletTransactions)
            .set({
            status: 'rejected',
            description: (0, drizzle_orm_1.sql) `concat(${schema_1.walletTransactions.description}, ' (Rejected: ', ${adminNotes || 'Declined'}, ')')`,
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, request.userId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'withdrawal'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'pending'), (0, drizzle_orm_1.sql) `${schema_1.walletTransactions.metadata}->>'withdrawalRequestId' = ${requestId}`));
        return updated;
    }
    async getUserWalletSummary(userId) {
        const [u] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!u)
            throw new common_1.NotFoundException('User not found');
        const summary = await this.getWalletSummary(userId);
        let vendorInfo = null;
        if (u.role === 'vendor') {
            const [v] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId)).limit(1);
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
    async getVendorWalletSummary(vendorId) {
        const [v] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId)).limit(1);
        if (!v)
            throw new common_1.NotFoundException('Vendor not found');
        const [u] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, v.userId)).limit(1);
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
    async adjustWallet(dto, adminId) {
        let targetUserId = dto.userId;
        if (!targetUserId && dto.vendorId) {
            const [v] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.id, dto.vendorId)).limit(1);
            if (!v)
                throw new common_1.NotFoundException('Vendor not found');
            targetUserId = v.userId;
        }
        if (!targetUserId) {
            throw new common_1.BadRequestException('Either userId or vendorId must be provided');
        }
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, targetUserId)).limit(1);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const amount = Math.round(Number(dto.amount) * 100) / 100;
        if (isNaN(amount) || amount <= 0) {
            throw new common_1.BadRequestException('Adjustment amount must be a positive number greater than 0');
        }
        const description = (dto.description || '').trim();
        if (!description) {
            throw new common_1.BadRequestException('Reason or description is required for wallet adjustment');
        }
        const wallet = await this.getOrCreateWallet(targetUserId);
        if (dto.action === 'debit') {
            const currentBalance = Math.round(wallet.balance * 100) / 100;
            if (currentBalance < amount) {
                throw new common_1.BadRequestException(`Insufficient wallet balance. Current balance is ₹${currentBalance}, cannot deduct ₹${amount}`);
            }
            await this.db
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} - ${amount}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
            if (user.role === 'customer') {
                await this.deductWalletFifo(this.db, targetUserId, amount);
            }
            const [tx] = await this.db
                .insert(schema_1.walletTransactions)
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
                this.notifications.notifyPush(targetUserId, 'wallet_adjustment', (0, wallet_adjustment_1.walletAdjustedPush)({
                    action: 'debit',
                    amount,
                    newBalance: updatedSummary.wallet.balance,
                    reason: description,
                    role: user.role,
                }));
            }
            catch {
            }
            return {
                success: true,
                message: `Successfully debited ₹${amount} from wallet`,
                transaction: tx,
                summary: updatedSummary,
            };
        }
        else {
            const expiryDays = dto.validityDays ?? (await this.walletAmountExpiryDays());
            const expiresAt = user.role === 'customer' ? new Date(Date.now() + expiryDays * 86400000) : null;
            const remainingAmount = user.role === 'customer' ? amount : null;
            await this.db
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${amount}`,
                totalEarned: (0, drizzle_orm_1.sql) `${schema_1.wallets.totalEarned} + ${amount}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
            const [tx] = await this.db
                .insert(schema_1.walletTransactions)
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
                this.notifications.notifyPush(targetUserId, 'wallet_adjustment', (0, wallet_adjustment_1.walletAdjustedPush)({
                    action: 'credit',
                    amount,
                    newBalance: updatedSummary.wallet.balance,
                    reason: description,
                    role: user.role,
                }));
            }
            catch {
            }
            return {
                success: true,
                message: `Successfully credited ₹${amount} to wallet`,
                transaction: tx,
                summary: updatedSummary,
            };
        }
    }
    async listWallets(params) {
        const role = params.role && params.role !== 'all' ? params.role : undefined;
        const conditions = [];
        if (role) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.users.role, role));
        }
        else {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.users.role, 'customer'), (0, drizzle_orm_1.eq)(schema_1.users.role, 'vendor')));
        }
        const rows = await this.db
            .select({
            walletId: schema_1.wallets.id,
            userId: schema_1.users.id,
            userName: schema_1.users.name,
            userPhone: schema_1.users.phone,
            userEmail: schema_1.users.email,
            userRole: schema_1.users.role,
            userStatus: schema_1.users.status,
            userCreatedAt: schema_1.users.createdAt,
            balance: (0, drizzle_orm_1.sql) `coalesce(${schema_1.wallets.balance}, 0)`,
            totalEarned: (0, drizzle_orm_1.sql) `coalesce(${schema_1.wallets.totalEarned}, 0)`,
            totalWithdrawn: (0, drizzle_orm_1.sql) `coalesce(${schema_1.wallets.totalWithdrawn}, 0)`,
            walletUpdatedAt: schema_1.wallets.updatedAt,
            vendorId: schema_1.vendors.id,
            businessName: schema_1.vendors.businessName,
            vendorType: schema_1.vendors.type,
        })
            .from(schema_1.users)
            .leftJoin(schema_1.wallets, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.wallets.userId))
            .leftJoin(schema_1.vendors, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.vendors.userId))
            .where((0, drizzle_orm_1.and)(...conditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.wallets.balance), (0, drizzle_orm_1.desc)(schema_1.users.createdAt));
        let filtered = rows;
        if (params.search && params.search.trim()) {
            const q = params.search.trim().toLowerCase();
            filtered = filtered.filter((r) => (r.userName && r.userName.toLowerCase().includes(q)) ||
                (r.userPhone && r.userPhone.includes(q)) ||
                (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
                (r.businessName && r.businessName.toLowerCase().includes(q)));
        }
        return filtered.map((r) => ({
            walletId: r.walletId,
            userId: r.userId,
            userName: r.userName ||
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
            id: schema_1.walletTransactions.id,
            walletId: schema_1.walletTransactions.walletId,
            userId: schema_1.walletTransactions.userId,
            amount: schema_1.walletTransactions.amount,
            remainingAmount: schema_1.walletTransactions.remainingAmount,
            expiresAt: schema_1.walletTransactions.expiresAt,
            expiredAt: schema_1.walletTransactions.expiredAt,
            restoredAt: schema_1.walletTransactions.restoredAt,
            type: schema_1.walletTransactions.type,
            status: schema_1.walletTransactions.status,
            description: schema_1.walletTransactions.description,
            orderId: schema_1.walletTransactions.orderId,
            orderType: schema_1.walletTransactions.orderType,
            couponCode: schema_1.walletTransactions.couponCode,
            metadata: schema_1.walletTransactions.metadata,
            createdAt: schema_1.walletTransactions.createdAt,
            userName: schema_1.users.name,
            userPhone: schema_1.users.phone,
            userRole: schema_1.users.role,
            businessName: schema_1.vendors.businessName,
            vendorId: schema_1.vendors.id,
        })
            .from(schema_1.walletTransactions)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, schema_1.users.id))
            .leftJoin(schema_1.vendors, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.vendors.userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.walletTransactions.createdAt))
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
            userName: r.userName ||
                (r.userRole === 'customer'
                    ? `Customer +91 ${r.userPhone ?? ''}`
                    : `${r.businessName || 'Vendor'}`),
            userPhone: r.userPhone,
            userRole: r.userRole,
            businessName: r.businessName,
            vendorId: r.vendorId,
        }));
    }
    async listAllScratchCards(params) {
        await this.expireOldScratchCards();
        const conditions = [];
        if (params.status && params.status !== 'all') {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.scratchCards.status, params.status));
        }
        if (params.userId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, params.userId));
        }
        const rows = await this.db
            .select({
            id: schema_1.scratchCards.id,
            userId: schema_1.scratchCards.userId,
            orderId: schema_1.scratchCards.orderId,
            orderType: schema_1.scratchCards.orderType,
            status: schema_1.scratchCards.status,
            amount: schema_1.scratchCards.amount,
            scratchedAt: schema_1.scratchCards.scratchedAt,
            expiresAt: schema_1.scratchCards.expiresAt,
            expiredAt: schema_1.scratchCards.expiredAt,
            restoredAt: schema_1.scratchCards.restoredAt,
            adminNotes: schema_1.scratchCards.adminNotes,
            createdAt: schema_1.scratchCards.createdAt,
            userName: schema_1.users.name,
            userPhone: schema_1.users.phone,
            userEmail: schema_1.users.email,
            userRole: schema_1.users.role,
        })
            .from(schema_1.scratchCards)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.scratchCards.userId, schema_1.users.id))
            .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.scratchCards.createdAt))
            .limit(params.limit ?? 100);
        let filtered = rows;
        if (params.search && params.search.trim()) {
            const q = params.search.trim().toLowerCase();
            filtered = filtered.filter((r) => (r.userName && r.userName.toLowerCase().includes(q)) ||
                (r.userPhone && r.userPhone.includes(q)) ||
                (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
                (r.orderId && r.orderId.toLowerCase().includes(q)));
        }
        return filtered;
    }
    async restoreScratchCard(cardId, dto) {
        const [card] = await this.db.select().from(schema_1.scratchCards).where((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId)).limit(1);
        if (!card)
            throw new common_1.NotFoundException('Scratch card not found');
        const defaultDays = await this.scratchCardExpiryDays();
        const days = dto.validityDays && dto.validityDays > 0 ? dto.validityDays : defaultDays;
        const newExpiresAt = new Date(Date.now() + days * 86400000);
        const [updated] = await this.db
            .update(schema_1.scratchCards)
            .set({
            status: 'unscratched',
            amount: null,
            scratchedAt: null,
            expiredAt: null,
            expiresAt: newExpiresAt,
            restoredAt: new Date(),
            adminNotes: dto.notes ?? `Restored by admin with ${days}-day validity`,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId))
            .returning();
        return this.toScratchCardView(updated);
    }
    async adjustScratchCardExpiry(cardId, dto) {
        const [card] = await this.db.select().from(schema_1.scratchCards).where((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId)).limit(1);
        if (!card)
            throw new common_1.NotFoundException('Scratch card not found');
        let newExpiresAt;
        if (dto.expiresAt) {
            newExpiresAt = new Date(dto.expiresAt);
        }
        else if (dto.validityDays && dto.validityDays > 0) {
            newExpiresAt = new Date(Date.now() + dto.validityDays * 86400000);
        }
        else {
            throw new common_1.BadRequestException('Either expiresAt or validityDays must be provided');
        }
        const updates = {
            expiresAt: newExpiresAt,
            adminNotes: dto.notes ?? `Validity adjusted by admin`,
        };
        if (card.status === 'expired' && newExpiresAt > new Date()) {
            updates.status = 'unscratched';
            updates.expiredAt = null;
            updates.restoredAt = new Date();
        }
        else if (card.status === 'unscratched' && newExpiresAt <= new Date()) {
            updates.status = 'expired';
            updates.expiredAt = new Date();
        }
        const [updated] = await this.db
            .update(schema_1.scratchCards)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.scratchCards.id, cardId))
            .returning();
        return this.toScratchCardView(updated);
    }
    async getCustomerCredits(userId) {
        await this.expireOldWalletAmounts(userId);
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user)
            throw new common_1.NotFoundException('Customer not found');
        const wallet = await this.getOrCreateWallet(userId);
        const credits = await this.db
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.gt)(schema_1.walletTransactions.amount, 0), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'expiry'))))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.walletTransactions.createdAt))
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
    async restoreWalletCredit(txId, dto, adminId) {
        const [tx] = await this.db.select().from(schema_1.walletTransactions).where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, txId)).limit(1);
        if (!tx)
            throw new common_1.NotFoundException('Transaction record not found');
        const defaultDays = await this.walletAmountExpiryDays();
        const days = dto.validityDays && dto.validityDays > 0 ? dto.validityDays : defaultDays;
        const newExpiresAt = new Date(Date.now() + days * 86400000);
        const restoreAmount = dto.amount && dto.amount > 0 ? Math.round(dto.amount * 100) / 100 : Math.abs(tx.amount);
        if (restoreAmount <= 0) {
            throw new common_1.BadRequestException('Restoration amount must be greater than zero');
        }
        const wallet = await this.getOrCreateWallet(tx.userId);
        const result = await this.db.transaction(async (trx) => {
            await trx
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${restoreAmount}`,
                totalEarned: (0, drizzle_orm_1.sql) `${schema_1.wallets.totalEarned} + ${restoreAmount}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
            const [restoredTx] = await trx
                .insert(schema_1.walletTransactions)
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
            await trx
                .update(schema_1.walletTransactions)
                .set({ restoredAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, tx.id));
            return restoredTx;
        });
        try {
            const summary = await this.getWalletSummary(tx.userId);
            this.notifications.notifyPush(tx.userId, 'wallet_adjustment', (0, wallet_adjustment_1.walletAdjustedPush)({
                action: 'credit',
                amount: restoreAmount,
                newBalance: summary.wallet.balance,
                reason: dto.notes || 'Restored expired wallet amount',
                role: 'customer',
            }));
        }
        catch {
        }
        return {
            success: true,
            message: `Successfully restored ₹${restoreAmount} with ${days}-day validity`,
            transaction: result,
        };
    }
    async adjustWalletCreditExpiry(txId, dto) {
        const [tx] = await this.db.select().from(schema_1.walletTransactions).where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, txId)).limit(1);
        if (!tx)
            throw new common_1.NotFoundException('Transaction record not found');
        let newExpiresAt;
        if (dto.expiresAt) {
            newExpiresAt = new Date(dto.expiresAt);
        }
        else if (dto.validityDays && dto.validityDays > 0) {
            newExpiresAt = new Date(Date.now() + dto.validityDays * 86400000);
        }
        else {
            throw new common_1.BadRequestException('Either expiresAt or validityDays must be provided');
        }
        const [updated] = await this.db
            .update(schema_1.walletTransactions)
            .set({
            expiresAt: newExpiresAt,
            restoredAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.walletTransactions.id, txId))
            .returning();
        return updated;
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map