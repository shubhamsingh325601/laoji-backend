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
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const drizzle_orm_1 = require("drizzle-orm");
const rxjs_1 = require("rxjs");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const upi_deeplink_provider_1 = require("./providers/upi-deeplink.provider");
const cod_provider_1 = require("./providers/cod.provider");
const razorpay_provider_1 = require("./providers/razorpay.provider");
const revenue_config_service_1 = require("../revenue/revenue-config.service");
const wallet_service_1 = require("../wallet/wallet.service");
const PAYMENT_SATISFIED = ['paid', 'pending_cod', 'collected'];
let PaymentService = class PaymentService {
    db;
    config;
    upi;
    cod;
    razorpay;
    revenueConfig;
    wallet;
    paymentSatisfied$ = new rxjs_1.Subject();
    onPaymentSatisfied = this.paymentSatisfied$.asObservable();
    constructor(db, config, upi, cod, razorpay, revenueConfig, wallet) {
        this.db = db;
        this.config = config;
        this.upi = upi;
        this.cod = cod;
        this.razorpay = razorpay;
        this.revenueConfig = revenueConfig;
        this.wallet = wallet;
    }
    async vendorIdForOrder(type, order) {
        if (type === 'grocery')
            return order.vendorId ?? null;
        if (!order.restaurantId)
            return null;
        const [restaurant] = await this.db.select().from(schema_1.restaurants).where((0, drizzle_orm_1.eq)(schema_1.restaurants.id, order.restaurantId)).limit(1);
        return restaurant?.vendorId ?? null;
    }
    isSatisfied(status) {
        return PAYMENT_SATISFIED.includes(status);
    }
    onlineProvider() {
        const selected = this.config.get('PAYMENT_PROVIDER');
        return selected === 'razorpay' ? { provider: this.razorpay, name: 'razorpay' } : { provider: this.upi, name: 'upi_deeplink' };
    }
    orderTable(type) {
        return type === 'grocery' ? schema_1.groceryOrders : schema_1.foodOrders;
    }
    async requireOwnOrder(type, orderId, customerId) {
        const table = this.orderTable(type);
        const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.customerId !== customerId)
            throw new common_1.ForbiddenException('Not your order');
        return order;
    }
    async setOrderPaymentStatus(type, orderId, status, method, walletAmount) {
        const table = this.orderTable(type);
        await this.db
            .update(table)
            .set({
            paymentStatus: status,
            ...(method ? { paymentMethod: method } : {}),
            ...(walletAmount !== undefined ? { walletAmount } : {}),
        })
            .where((0, drizzle_orm_1.eq)(table.id, orderId));
    }
    async debitWalletForOrder(type, orderId, customerId, maxAmount) {
        return this.wallet.debitCustomerForOrder(customerId, maxAmount, orderId, type);
    }
    async refundWalletPortion(type, orderId, customerId) {
        const txs = await this.db
            .select({ type: schema_1.walletTransactions.type, amount: schema_1.walletTransactions.amount })
            .from(schema_1.walletTransactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletTransactions.orderId, orderId), (0, drizzle_orm_1.inArray)(schema_1.walletTransactions.type, ['order_payment', 'order_refund'])));
        const net = txs.reduce((sum, t) => sum + (t.type === 'order_payment' ? t.amount : -t.amount), 0);
        const amount = Math.round(net * 100) / 100;
        if (amount <= 0)
            return;
        await this.wallet.refundCustomerForOrder(customerId, amount, orderId, type);
        const table = this.orderTable(type);
        await this.db.update(table).set({ walletAmount: 0 }).where((0, drizzle_orm_1.eq)(table.id, orderId));
    }
    async latestPayment(type, orderId) {
        const [row] = await this.db
            .select()
            .from(schema_1.payments)
            .where(type === 'grocery' ? (0, drizzle_orm_1.eq)(schema_1.payments.groceryOrderId, orderId) : (0, drizzle_orm_1.eq)(schema_1.payments.foodOrderId, orderId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.payments.createdAt))
            .limit(1);
        return row ?? null;
    }
    async initiate(type, orderId, customerId, method, useWallet = false) {
        const order = await this.requireOwnOrder(type, orderId, customerId);
        const existing = await this.latestPayment(type, orderId);
        if (existing && existing.status !== 'failed') {
            const abandonedOnline = existing.status === 'pending' && existing.provider !== 'cod' && existing.provider !== 'wallet' && method !== 'online';
            if (!abandonedOnline)
                return existing;
            const dropped = await this.db
                .update(schema_1.payments)
                .set({ status: 'failed' })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.payments.id, existing.id), (0, drizzle_orm_1.eq)(schema_1.payments.status, 'pending')))
                .returning({ id: schema_1.payments.id });
            if (!dropped.length)
                return (await this.latestPayment(type, orderId)) ?? existing;
            await this.refundWalletPortion(type, orderId, customerId);
        }
        if (useWallet && method !== 'wallet') {
            const w = await this.wallet.getOrCreateWallet(customerId);
            if (Math.round(w.balance * 100) / 100 >= order.total)
                method = 'wallet';
        }
        if (method === 'wallet') {
            const wallet = await this.wallet.getOrCreateWallet(customerId);
            const currentBalance = Math.round(wallet.balance * 100) / 100;
            if (currentBalance < order.total) {
                throw new common_1.BadRequestException(`Insufficient wallet balance. Available balance is ₹${currentBalance}, but order total is ₹${order.total}`);
            }
            const deducted = await this.db
                .update(schema_1.wallets)
                .set({
                balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} - ${order.total}`,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id), (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} >= ${order.total}`))
                .returning({ id: schema_1.wallets.id });
            if (!deducted.length) {
                throw new common_1.BadRequestException('Wallet balance changed — please refresh and try again.');
            }
            const orderCode = orderId.slice(0, 8).toUpperCase();
            await this.db.insert(schema_1.walletTransactions).values({
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
                .insert(schema_1.payments)
                .values({
                ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
                provider: 'wallet',
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
                throw new common_1.BadRequestException(`Cash on delivery isn't available for orders above ₹${codThreshold}`);
            }
        }
        const walletUsed = useWallet ? await this.debitWalletForOrder(type, orderId, customerId, order.total) : 0;
        const payable = Math.round((order.total - walletUsed) * 100) / 100;
        const { provider, name } = method === 'cod' ? { provider: this.cod, name: 'cod' } : this.onlineProvider();
        let result;
        try {
            result = await provider.initiate({ orderId, amount: payable });
        }
        catch (err) {
            if (walletUsed > 0)
                await this.refundWalletPortion(type, orderId, customerId);
            throw err;
        }
        const [payment] = await this.db
            .insert(schema_1.payments)
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
    async getForOrder(type, orderId, customerId) {
        await this.requireOwnOrder(type, orderId, customerId);
        const payment = await this.latestPayment(type, orderId);
        if (!payment)
            throw new common_1.NotFoundException('No payment initiated for this order yet');
        return payment;
    }
    async confirmByCustomer(type, orderId, customerId) {
        await this.requireOwnOrder(type, orderId, customerId);
        const payment = await this.latestPayment(type, orderId);
        if (!payment)
            throw new common_1.NotFoundException('No payment initiated for this order yet');
        if (payment.provider === 'cod') {
            throw new common_1.BadRequestException('This order is cash on delivery — nothing to confirm online');
        }
        if (payment.status !== 'pending') {
            throw new common_1.BadRequestException(`Payment is already "${payment.status}" — nothing to confirm`);
        }
        const [updated] = await this.db
            .update(schema_1.payments)
            .set({ status: 'paid', updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id))
            .returning();
        await this.setOrderPaymentStatus(type, orderId, 'paid', 'upi');
        this.paymentSatisfied$.next({ type, orderId });
        return updated;
    }
    async markCodCollected(type, orderId) {
        const payment = await this.latestPayment(type, orderId);
        if (!payment || payment.provider !== 'cod')
            return;
        await this.db.update(schema_1.payments).set({ status: 'collected', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
        await this.setOrderPaymentStatus(type, orderId, 'collected', 'cod');
    }
    async markRefundPendingIfPaid(type, orderId) {
        const payment = await this.latestPayment(type, orderId);
        if (!payment)
            return;
        if (payment.provider !== 'wallet' && ['paid', 'pending', 'pending_cod'].includes(payment.status)) {
            const table = this.orderTable(type);
            const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
            if (order && order.walletAmount > 0)
                await this.refundWalletPortion(type, orderId, order.customerId);
        }
        if (payment.status !== 'paid')
            return;
        if (payment.provider === 'wallet') {
            const table = this.orderTable(type);
            const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
            if (order) {
                const wallet = await this.wallet.getOrCreateWallet(order.customerId);
                await this.db
                    .update(schema_1.wallets)
                    .set({
                    balance: (0, drizzle_orm_1.sql) `${schema_1.wallets.balance} + ${payment.amount}`,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.wallets.id, wallet.id));
                await this.db.insert(schema_1.walletTransactions).values({
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
            await this.db.update(schema_1.payments).set({ status: 'refunded', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
            await this.setOrderPaymentStatus(type, orderId, 'refunded', 'wallet');
            return;
        }
        await this.db.update(schema_1.payments).set({ status: 'refund_pending', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
        await this.setOrderPaymentStatus(type, orderId, 'refund_pending');
    }
    async restorePaymentStatusIfRestored(type, orderId) {
        const payment = await this.latestPayment(type, orderId);
        if (payment && payment.status === 'refund_pending') {
            await this.db.update(schema_1.payments).set({ status: 'paid', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
            await this.setOrderPaymentStatus(type, orderId, 'paid');
        }
    }
    async enrichForAdmin(rows) {
        if (!rows.length)
            return [];
        const groceryIds = rows.filter((r) => r.groceryOrderId).map((r) => r.groceryOrderId);
        const foodIds = rows.filter((r) => r.foodOrderId).map((r) => r.foodOrderId);
        const groceryRows = groceryIds.length
            ? await this.db.select().from(schema_1.groceryOrders).where((0, drizzle_orm_1.inArray)(schema_1.groceryOrders.id, groceryIds))
            : [];
        const foodRows = foodIds.length ? await this.db.select().from(schema_1.foodOrders).where((0, drizzle_orm_1.inArray)(schema_1.foodOrders.id, foodIds)) : [];
        const groceryById = new Map(groceryRows.map((o) => [o.id, o]));
        const foodById = new Map(foodRows.map((o) => [o.id, o]));
        const customerIds = [...new Set([...groceryRows, ...foodRows].map((o) => o.customerId))];
        const customerRows = customerIds.length
            ? await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.inArray)(schema_1.users.id, customerIds))
            : [];
        const phoneByCustomerId = new Map(customerRows.map((u) => [u.id, u.phone ?? '']));
        return rows.map((r) => {
            const type = r.groceryOrderId ? 'grocery' : 'food';
            const order = r.groceryOrderId ? groceryById.get(r.groceryOrderId) : foodById.get(r.foodOrderId);
            return {
                id: r.id,
                type,
                orderId: (r.groceryOrderId ?? r.foodOrderId),
                orderCode: (r.groceryOrderId ?? r.foodOrderId).slice(0, 8).toUpperCase(),
                provider: r.provider,
                amount: r.amount,
                upiDeepLink: r.upiDeepLink,
                customerPhone: order ? (phoneByCustomerId.get(order.customerId) ?? '') : '',
                createdAt: r.createdAt,
            };
        });
    }
    async listPendingForAdmin() {
        const rows = await this.db.select().from(schema_1.payments).where((0, drizzle_orm_1.eq)(schema_1.payments.status, 'pending'));
        return this.enrichForAdmin(rows);
    }
    async reconcile(paymentId, adminUserId, status) {
        const [payment] = await this.db.select().from(schema_1.payments).where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId)).limit(1);
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.status !== 'pending') {
            throw new common_1.BadRequestException(`Payment is already "${payment.status}" — nothing to reconcile`);
        }
        const [updated] = await this.db
            .update(schema_1.payments)
            .set({ status, reconciledBy: adminUserId, reconciledAt: new Date(), updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId))
            .returning();
        const type = payment.groceryOrderId ? 'grocery' : 'food';
        const orderId = (payment.groceryOrderId ?? payment.foodOrderId);
        await this.setOrderPaymentStatus(type, orderId, status);
        if (status === 'failed') {
            const table = this.orderTable(type);
            const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
            if (order && order.walletAmount > 0)
                await this.refundWalletPortion(type, orderId, order.customerId);
        }
        if (status === 'paid') {
            const table = this.orderTable(type);
            const [order] = await this.db.select().from(table).where((0, drizzle_orm_1.eq)(table.id, orderId)).limit(1);
            if (order && !['cancelled', 'failed'].includes(order.status)) {
                this.paymentSatisfied$.next({ type, orderId });
            }
        }
        return updated;
    }
    async listRefundsForAdmin() {
        const rows = await this.db.select().from(schema_1.payments).where((0, drizzle_orm_1.eq)(schema_1.payments.status, 'refund_pending'));
        return this.enrichForAdmin(rows);
    }
    async markRefunded(paymentId, adminUserId) {
        const [payment] = await this.db.select().from(schema_1.payments).where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId)).limit(1);
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.status !== 'refund_pending') {
            throw new common_1.BadRequestException(`Payment is "${payment.status}" — nothing to refund`);
        }
        const [updated] = await this.db
            .update(schema_1.payments)
            .set({ status: 'refunded', reconciledBy: adminUserId, reconciledAt: new Date(), updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.payments.id, paymentId))
            .returning();
        const type = payment.groceryOrderId ? 'grocery' : 'food';
        await this.setOrderPaymentStatus(type, (payment.groceryOrderId ?? payment.foodOrderId), 'refunded');
        return updated;
    }
    async getPaymentSettings() {
        let upiId = this.config.get('UPI_VPA') || '8005949152-3@ybl';
        let payeeName = this.config.get('UPI_PAYEE_NAME') || 'Laoji';
        try {
            const rows = await this.db
                .select({ key: schema_1.platformSettings.key, value: schema_1.platformSettings.value })
                .from(schema_1.platformSettings)
                .where((0, drizzle_orm_1.inArray)(schema_1.platformSettings.key, [
                upi_deeplink_provider_1.PLATFORM_KEY_CUSTOMER_UPI_VPA,
                upi_deeplink_provider_1.PLATFORM_KEY_CUSTOMER_UPI_PAYEE,
            ]));
            for (const r of rows) {
                if (r.key === upi_deeplink_provider_1.PLATFORM_KEY_CUSTOMER_UPI_VPA && r.value?.trim()) {
                    upiId = r.value.trim();
                }
                else if (r.key === upi_deeplink_provider_1.PLATFORM_KEY_CUSTOMER_UPI_PAYEE && r.value?.trim()) {
                    payeeName = r.value.trim();
                }
            }
        }
        catch {
        }
        return { upiId, payeeName };
    }
    async updatePaymentSettings(dto, adminUserId) {
        const trimmedUpi = dto.upiId?.trim();
        if (!trimmedUpi || !trimmedUpi.includes('@') || trimmedUpi.length < 5) {
            throw new common_1.BadRequestException('A valid UPI ID (e.g. store@bank or 8005949152-3@ybl) is required.');
        }
        const trimmedPayee = dto.payeeName?.trim() || 'Laoji';
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: upi_deeplink_provider_1.PLATFORM_KEY_CUSTOMER_UPI_VPA,
            value: trimmedUpi,
            description: 'Customer UPI payment VPA / address',
            updatedAt: new Date(),
            updatedBy: adminUserId || null,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: {
                value: trimmedUpi,
                updatedAt: new Date(),
                updatedBy: adminUserId || null,
            },
        });
        await this.db
            .insert(schema_1.platformSettings)
            .values({
            key: upi_deeplink_provider_1.PLATFORM_KEY_CUSTOMER_UPI_PAYEE,
            value: trimmedPayee,
            description: 'Customer UPI payee name',
            updatedAt: new Date(),
            updatedBy: adminUserId || null,
        })
            .onConflictDoUpdate({
            target: schema_1.platformSettings.key,
            set: {
                value: trimmedPayee,
                updatedAt: new Date(),
                updatedBy: adminUserId || null,
            },
        });
        return {
            upiId: trimmedUpi,
            payeeName: trimmedPayee,
            message: `Customer payment UPI ID updated to ${trimmedUpi}`,
        };
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService,
        upi_deeplink_provider_1.UpiDeepLinkProvider,
        cod_provider_1.CodProvider,
        razorpay_provider_1.RazorpayProvider,
        revenue_config_service_1.RevenueConfigService,
        wallet_service_1.WalletService])
], PaymentService);
//# sourceMappingURL=payment.service.js.map