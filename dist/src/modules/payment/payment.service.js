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
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const upi_deeplink_provider_1 = require("./providers/upi-deeplink.provider");
const cod_provider_1 = require("./providers/cod.provider");
const razorpay_provider_1 = require("./providers/razorpay.provider");
const revenue_config_service_1 = require("../revenue/revenue-config.service");
const PAYMENT_SATISFIED = ['paid', 'pending_cod', 'collected'];
let PaymentService = class PaymentService {
    db;
    config;
    upi;
    cod;
    razorpay;
    revenueConfig;
    constructor(db, config, upi, cod, razorpay, revenueConfig) {
        this.db = db;
        this.config = config;
        this.upi = upi;
        this.cod = cod;
        this.razorpay = razorpay;
        this.revenueConfig = revenueConfig;
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
    async setOrderPaymentStatus(type, orderId, status) {
        const table = this.orderTable(type);
        await this.db.update(table).set({ paymentStatus: status }).where((0, drizzle_orm_1.eq)(table.id, orderId));
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
    async initiate(type, orderId, customerId, method) {
        const order = await this.requireOwnOrder(type, orderId, customerId);
        const existing = await this.latestPayment(type, orderId);
        if (existing && existing.status !== 'failed')
            return existing;
        if (method === 'cod') {
            const vendorId = await this.vendorIdForOrder(type, order);
            const { codThreshold } = vendorId ? await this.revenueConfig.resolve(vendorId, null) : { codThreshold: null };
            if (codThreshold !== null && order.total > codThreshold) {
                throw new common_1.BadRequestException(`Cash on delivery isn't available for orders above ₹${codThreshold}`);
            }
        }
        const { provider, name } = method === 'cod' ? { provider: this.cod, name: 'cod' } : this.onlineProvider();
        const result = await provider.initiate({ orderId, amount: order.total });
        const [payment] = await this.db
            .insert(schema_1.payments)
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
        await this.setOrderPaymentStatus(type, orderId, 'paid');
        return updated;
    }
    async markCodCollected(type, orderId) {
        const payment = await this.latestPayment(type, orderId);
        if (!payment || payment.provider !== 'cod')
            return;
        await this.db.update(schema_1.payments).set({ status: 'collected', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
        await this.setOrderPaymentStatus(type, orderId, 'collected');
    }
    async markRefundPendingIfPaid(type, orderId) {
        const payment = await this.latestPayment(type, orderId);
        if (!payment || payment.status !== 'paid')
            return;
        await this.db.update(schema_1.payments).set({ status: 'refund_pending', updatedAt: new Date() }).where((0, drizzle_orm_1.eq)(schema_1.payments.id, payment.id));
        await this.setOrderPaymentStatus(type, orderId, 'refund_pending');
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
        await this.setOrderPaymentStatus(type, (payment.groceryOrderId ?? payment.foodOrderId), status);
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
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService,
        upi_deeplink_provider_1.UpiDeepLinkProvider,
        cod_provider_1.CodProvider,
        razorpay_provider_1.RazorpayProvider,
        revenue_config_service_1.RevenueConfigService])
], PaymentService);
//# sourceMappingURL=payment.service.js.map