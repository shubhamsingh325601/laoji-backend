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
exports.VendorWithdrawalService = exports.PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL = exports.DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const notification_service_1 = require("../notification/notification.service");
const vendor_withdrawal_1 = require("../notification/templates/push/vendor-withdrawal");
exports.DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT = 500;
exports.PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL = 'vendor_min_withdrawal_limit';
const round2 = (n) => Math.round(n * 100) / 100;
const orderCode = (id) => id.slice(0, 8).toUpperCase();
let VendorWithdrawalService = class VendorWithdrawalService {
    db;
    notifications;
    constructor(db, notifications) {
        this.db = db;
        this.notifications = notifications;
    }
    async totalEarned(vendorId) {
        const total = (0, drizzle_orm_1.sql) `coalesce(sum(${schema_1.settlements.vendorPayout}), 0)`;
        const [[grocery], [food]] = await Promise.all([
            this.db
                .select({ total })
                .from(schema_1.settlements)
                .innerJoin(schema_1.groceryOrders, (0, drizzle_orm_1.eq)(schema_1.settlements.groceryOrderId, schema_1.groceryOrders.id))
                .where((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendorId)),
            this.db
                .select({ total })
                .from(schema_1.settlements)
                .innerJoin(schema_1.foodOrders, (0, drizzle_orm_1.eq)(schema_1.settlements.foodOrderId, schema_1.foodOrders.id))
                .innerJoin(schema_1.restaurants, (0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, schema_1.restaurants.id))
                .where((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendorId)),
        ]);
        return Number(grocery?.total ?? 0) + Number(food?.total ?? 0);
    }
    async getBalance(vendorId) {
        const [totalEarned, byStatus] = await Promise.all([
            this.totalEarned(vendorId),
            this.db
                .select({
                status: schema_1.vendorWithdrawals.status,
                total: (0, drizzle_orm_1.sql) `coalesce(sum(${schema_1.vendorWithdrawals.amount}), 0)`,
            })
                .from(schema_1.vendorWithdrawals)
                .where((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.vendorId, vendorId))
                .groupBy(schema_1.vendorWithdrawals.status),
        ]);
        const sumFor = (status) => Number(byStatus.find((r) => r.status === status)?.total ?? 0);
        const totalWithdrawn = sumFor('approved');
        const pendingAmount = sumFor('pending');
        return {
            availableBalance: Math.max(0, round2(totalEarned - totalWithdrawn - pendingAmount)),
            totalEarned: round2(totalEarned),
            totalWithdrawn: round2(totalWithdrawn),
            pendingAmount: round2(pendingAmount),
        };
    }
    async getMinWithdrawalLimit() {
        const [row] = await this.db
            .select({ value: schema_1.platformSettings.value })
            .from(schema_1.platformSettings)
            .where((0, drizzle_orm_1.eq)(schema_1.platformSettings.key, exports.PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL))
            .limit(1);
        if (!row || !row.value)
            return exports.DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT;
        const parsed = Number(row.value);
        return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : exports.DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT;
    }
    async updateMinWithdrawalLimit(limit, adminId) {
        const val = round2(Number(limit));
        if (!Number.isFinite(val) || val < 1) {
            throw new common_1.BadRequestException('Minimum withdrawal limit must be at least ₹1.');
        }
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: exports.PLATFORM_KEY_VENDOR_MIN_WITHDRAWAL,
            value: String(val),
            description: 'Minimum withdrawal limit for vendors in INR',
            updatedAt: new Date(),
            updatedBy: adminId || null,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
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
    async vendorForUser(userId) {
        const [vendor] = await this.db.select().from(schema_1.vendors).where((0, drizzle_orm_1.eq)(schema_1.vendors.userId, userId)).limit(1);
        if (!vendor)
            throw new common_1.NotFoundException('Vendor profile not set up yet');
        return vendor;
    }
    async listForVendor(userId) {
        const vendor = await this.vendorForUser(userId);
        const [balance, rows, minWithdrawalLimit] = await Promise.all([
            this.getBalance(vendor.id),
            this.db
                .select()
                .from(schema_1.vendorWithdrawals)
                .where((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.vendorId, vendor.id))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.vendorWithdrawals.createdAt))
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
                payoutDestination: w.upiId ?? (w.bankAccount ? `•••• ${w.bankAccount.slice(-4)}` : null),
                rejectionReason: w.rejectionReason,
                payoutReference: w.payoutReference,
                processedAt: w.processedAt,
                createdAt: w.createdAt,
            })),
        };
    }
    async request(userId, requested) {
        const vendor = await this.vendorForUser(userId);
        if (vendor.kycStatus !== 'verified') {
            throw new common_1.BadRequestException('KYC verification required before withdrawal. Please upload your Aadhaar card (front and back) to complete verification.');
        }
        if (!vendor.bankAccount && !vendor.upiId) {
            throw new common_1.BadRequestException('Please add your Bank Account or UPI ID before requesting a withdrawal so we know where to send your funds.');
        }
        const [open] = await this.db
            .select({ id: schema_1.vendorWithdrawals.id })
            .from(schema_1.vendorWithdrawals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.vendorId, vendor.id), (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.status, 'pending')))
            .limit(1);
        if (open) {
            throw new common_1.ConflictException('You already have a withdrawal request waiting for approval.');
        }
        const [{ availableBalance }, minLimit] = await Promise.all([
            this.getBalance(vendor.id),
            this.getMinWithdrawalLimit(),
        ]);
        if (availableBalance <= 0) {
            throw new common_1.BadRequestException('You do not have any balance to withdraw.');
        }
        if (availableBalance < minLimit) {
            throw new common_1.BadRequestException(`Minimum withdrawal limit is ₹${minLimit}. Your current available balance is ₹${availableBalance}.`);
        }
        const amount = requested === undefined ? availableBalance : round2(requested);
        if (amount <= 0)
            throw new common_1.BadRequestException('Withdrawal amount must be greater than zero.');
        if (amount < minLimit) {
            throw new common_1.BadRequestException(`Minimum withdrawal amount is ₹${minLimit}. You requested ₹${amount}.`);
        }
        if (amount > availableBalance) {
            throw new common_1.BadRequestException(`You can withdraw at most ₹${availableBalance}. You asked for ₹${amount}.`);
        }
        const [lastApproved] = await this.db
            .select({ periodEnd: schema_1.vendorWithdrawals.periodEnd })
            .from(schema_1.vendorWithdrawals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.vendorId, vendor.id), (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.status, 'approved')))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.vendorWithdrawals.periodEnd))
            .limit(1);
        const usesUpi = !!vendor.upiId;
        let created;
        try {
            [created] = await this.db
                .insert(schema_1.vendorWithdrawals)
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
        }
        catch (err) {
            if (err?.code === '23505') {
                throw new common_1.ConflictException('You already have a withdrawal request waiting for approval.');
            }
            throw err;
        }
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
    async listForAdmin(status) {
        const rows = await this.db
            .select({
            w: schema_1.vendorWithdrawals,
            businessName: schema_1.vendors.businessName,
            ownerName: schema_1.vendors.ownerName,
            vendorPhone: schema_1.users.phone,
        })
            .from(schema_1.vendorWithdrawals)
            .innerJoin(schema_1.vendors, (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.vendorId, schema_1.vendors.id))
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendors.userId, schema_1.users.id))
            .where(status ? (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.status, status) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.vendorWithdrawals.createdAt))
            .limit(200);
        return rows.map(({ w, businessName, ownerName, vendorPhone }) => ({
            ...this.toAdminSummary(w),
            vendor: { id: w.vendorId, businessName, ownerName, phone: vendorPhone },
        }));
    }
    async getForAdmin(id) {
        const [row] = await this.db
            .select({
            w: schema_1.vendorWithdrawals,
            businessName: schema_1.vendors.businessName,
            ownerName: schema_1.vendors.ownerName,
            vendorPhone: schema_1.users.phone,
        })
            .from(schema_1.vendorWithdrawals)
            .innerJoin(schema_1.vendors, (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.vendorId, schema_1.vendors.id))
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.vendors.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.id, id))
            .limit(1);
        if (!row)
            throw new common_1.NotFoundException('Withdrawal request not found');
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
                carriedOver: round2(w.availableBefore - periodNet),
                availableBefore: w.availableBefore,
                requested: w.amount,
                remainingAfter: round2(w.availableBefore - w.amount),
            },
            orders,
        };
    }
    async approve(id, adminId, payoutReference) {
        const [updated] = await this.db
            .update(schema_1.vendorWithdrawals)
            .set({
            status: 'approved',
            processedBy: adminId,
            processedAt: new Date(),
            payoutReference: payoutReference?.trim() || null,
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.id, id), (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.status, 'pending')))
            .returning();
        if (!updated)
            await this.throwNotPending(id);
        await this.notifyVendor(updated.vendorId, (userId) => this.notifications.notifyPush(userId, 'withdrawal_approved', (0, vendor_withdrawal_1.withdrawalApprovedVendorPush)(updated.amount)));
        return this.toAdminSummary(updated);
    }
    async reject(id, adminId, reason) {
        const [updated] = await this.db
            .update(schema_1.vendorWithdrawals)
            .set({
            status: 'rejected',
            processedBy: adminId,
            processedAt: new Date(),
            rejectionReason: reason,
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.id, id), (0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.status, 'pending')))
            .returning();
        if (!updated)
            await this.throwNotPending(id);
        await this.notifyVendor(updated.vendorId, (userId) => this.notifications.notifyPush(userId, 'withdrawal_rejected', (0, vendor_withdrawal_1.withdrawalRejectedVendorPush)(updated.amount, reason)));
        return this.toAdminSummary(updated);
    }
    async throwNotPending(id) {
        const [existing] = await this.db
            .select({ status: schema_1.vendorWithdrawals.status })
            .from(schema_1.vendorWithdrawals)
            .where((0, drizzle_orm_1.eq)(schema_1.vendorWithdrawals.id, id))
            .limit(1);
        if (!existing)
            throw new common_1.NotFoundException('Withdrawal request not found');
        throw new common_1.ConflictException(`This withdrawal request is already ${existing.status}.`);
    }
    async notifyVendor(vendorId, send) {
        const [vendor] = await this.db
            .select({ userId: schema_1.vendors.userId })
            .from(schema_1.vendors)
            .where((0, drizzle_orm_1.eq)(schema_1.vendors.id, vendorId))
            .limit(1);
        if (vendor)
            send(vendor.userId);
    }
    toAdminSummary(w) {
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
    async ordersInPeriod(vendorId, start, end) {
        const inRange = (column) => [
            ...(start ? [(0, drizzle_orm_1.gt)(column, start)] : []),
            (0, drizzle_orm_1.lte)(column, end),
        ];
        const settlementFields = {
            payout: schema_1.settlements.vendorPayout,
            commission: schema_1.settlements.platformShare,
            settledAt: schema_1.settlements.createdAt,
        };
        const orderFields = (t) => ({
            id: t.id,
            subtotal: t.subtotal,
            total: t.total,
            paymentStatus: t.paymentStatus,
            status: t.status,
            createdAt: t.createdAt,
        });
        const [groceryDone, foodDone] = await Promise.all([
            this.db
                .select({ ...settlementFields, order: orderFields(schema_1.groceryOrders) })
                .from(schema_1.settlements)
                .innerJoin(schema_1.groceryOrders, (0, drizzle_orm_1.eq)(schema_1.settlements.groceryOrderId, schema_1.groceryOrders.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendorId), ...inRange(schema_1.settlements.createdAt))),
            this.db
                .select({ ...settlementFields, order: orderFields(schema_1.foodOrders) })
                .from(schema_1.settlements)
                .innerJoin(schema_1.foodOrders, (0, drizzle_orm_1.eq)(schema_1.settlements.foodOrderId, schema_1.foodOrders.id))
                .innerJoin(schema_1.restaurants, (0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, schema_1.restaurants.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendorId), ...inRange(schema_1.settlements.createdAt))),
        ]);
        const delivered = [
            ...groceryDone.map((r) => ({ ...r, type: 'grocery' })),
            ...foodDone.map((r) => ({ ...r, type: 'food' })),
        ].map((r) => ({
            type: r.type,
            orderId: r.order.id,
            orderCode: orderCode(r.order.id),
            status: 'delivered',
            at: r.settledAt,
            subtotal: r.order.subtotal,
            orderTotal: r.order.total,
            commission: r.commission,
            vendorPayout: r.payout,
            paymentStatus: r.order.paymentStatus,
        }));
        const [groceryLost, foodLost] = await Promise.all([
            this.db
                .select(orderFields(schema_1.groceryOrders))
                .from(schema_1.groceryOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.groceryOrders.vendorId, vendorId), (0, drizzle_orm_1.inArray)(schema_1.groceryOrders.status, ['cancelled', 'failed']))),
            this.db
                .select(orderFields(schema_1.foodOrders))
                .from(schema_1.foodOrders)
                .innerJoin(schema_1.restaurants, (0, drizzle_orm_1.eq)(schema_1.foodOrders.restaurantId, schema_1.restaurants.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.restaurants.vendorId, vendorId), (0, drizzle_orm_1.inArray)(schema_1.foodOrders.status, ['cancelled', 'failed']))),
        ]);
        const endedAt = await this.terminalTimes(groceryLost.map((o) => o.id), foodLost.map((o) => o.id));
        const lost = [
            ...groceryLost.map((o) => ({ ...o, type: 'grocery' })),
            ...foodLost.map((o) => ({ ...o, type: 'food' })),
        ]
            .map((o) => ({ o, at: endedAt.get(o.id) ?? o.createdAt }))
            .filter(({ at }) => (!start || at > start) && at <= end)
            .map(({ o, at }) => ({
            type: o.type,
            orderId: o.id,
            orderCode: orderCode(o.id),
            status: o.status,
            at,
            subtotal: o.subtotal,
            orderTotal: o.total,
            commission: 0,
            vendorPayout: 0,
            paymentStatus: o.paymentStatus,
        }));
        return [...delivered, ...lost].sort((a, b) => b.at.getTime() - a.at.getTime());
    }
    async terminalTimes(groceryIds, foodIds) {
        const times = new Map();
        const terminal = (0, drizzle_orm_1.inArray)(schema_1.orderStatusHistory.status, ['cancelled', 'failed']);
        const [g, f] = await Promise.all([
            groceryIds.length
                ? this.db
                    .select({ id: schema_1.orderStatusHistory.groceryOrderId, at: schema_1.orderStatusHistory.changedAt })
                    .from(schema_1.orderStatusHistory)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.orderStatusHistory.groceryOrderId, groceryIds), terminal))
                : [],
            foodIds.length
                ? this.db
                    .select({ id: schema_1.orderStatusHistory.foodOrderId, at: schema_1.orderStatusHistory.changedAt })
                    .from(schema_1.orderStatusHistory)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.orderStatusHistory.foodOrderId, foodIds), terminal))
                : [],
        ]);
        for (const { id, at } of [...g, ...f]) {
            if (id && (!times.has(id) || at > times.get(id)))
                times.set(id, at);
        }
        return times;
    }
};
exports.VendorWithdrawalService = VendorWithdrawalService;
exports.VendorWithdrawalService = VendorWithdrawalService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, notification_service_1.NotificationService])
], VendorWithdrawalService);
//# sourceMappingURL=vendor-withdrawal.service.js.map