"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveredCustomerPush = deliveredCustomerPush;
exports.deliveredVendorPush = deliveredVendorPush;
exports.deliveredPartnerPush = deliveredPartnerPush;
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
//# sourceMappingURL=delivered.js.map