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
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
let WalletService = class WalletService {
    db;
    constructor(db) {
        this.db = db;
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
        const wallet = await this.getOrCreateWallet(userId);
        const pendingRows = await this.db
            .select()
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.type, 'affiliate_commission'), (0, drizzle_orm_1.eq)(schema_1.walletTransactions.status, 'pending')));
        const pendingEarnings = pendingRows.reduce((sum, r) => sum + r.amount, 0);
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
        for (const tx of pendingTxList) {
            await this.db
                .update(schema_1.walletTransactions)
                .set({ status: 'completed' })
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
    async requestWithdrawal(userId, dto) {
        const wallet = await this.getOrCreateWallet(userId);
        if (dto.amount <= 0) {
            throw new common_1.BadRequestException('Withdrawal amount must be greater than zero');
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
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object])
], WalletService);
//# sourceMappingURL=wallet.service.js.map