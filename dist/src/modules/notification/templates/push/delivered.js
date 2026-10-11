"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveredCustomerPush = deliveredCustomerPush;
exports.deliveredVendorPush = deliveredVendorPush;
exports.deliveredPartnerPush = deliveredPartnerPush;
exports.deliveredAdminPush = deliveredAdminPush;
function deliveredCustomerPush(orderCode, orderId, type = 'grocery') {
    return {
        title: 'Delivered!',
        body: `Order ${orderCode} has been delivered. Enjoying it? Rate your experience.`,
        data: {
            event: 'delivered',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
function deliveredVendorPush(orderCode, orderId) {
    return {
        title: 'Order complete',
        body: `Order ${orderCode} was delivered successfully.`,
        data: {
            event: 'delivered',
            orderCode,
            ...(orderId ? { orderId, link: `/order/${orderId}` } : {}),
        },
    };
}
function deliveredPartnerPush(orderCode, payout, orderId) {
    return {
        title: 'Earnings updated',
        body: `You completed order ${orderCode} — ₹${payout} added to your earnings.`,
        data: {
            event: 'delivered',
            orderCode,
            ...(orderId ? { orderId, link: `/earnings` } : {}),
        },
    };
}
function deliveredAdminPush(orderCode, orderId, type = 'grocery', total) {
    const typeLabel = type === 'food' ? 'Food' : 'Grocery';
    const amountPart = total !== undefined ? ` • ₹${total}` : '';
    return {
        title: `✅ ${typeLabel} Order Delivered #${orderCode}`,
        body: `Order #${orderCode}${amountPart} has been delivered successfully.`,
        data: {
            event: 'delivered',
            orderCode,
            type,
            ...(orderId ? { orderId, link: `/orders/${orderId}`, url: `/orders/${orderId}` } : {}),
        },
    };
}
//# sourceMappingURL=delivered.js.map