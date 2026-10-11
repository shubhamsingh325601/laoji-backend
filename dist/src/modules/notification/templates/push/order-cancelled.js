"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderCancelledCustomerPush = orderCancelledCustomerPush;
exports.orderCancelledVendorPush = orderCancelledVendorPush;
exports.orderCancelledPartnerPush = orderCancelledPartnerPush;
exports.orderCancelledAdminPush = orderCancelledAdminPush;
function orderCancelledCustomerPush(orderCode, orderId, type = 'grocery') {
    return {
        title: 'Order cancelled',
        body: `Order ${orderCode} could not be completed and has been cancelled. Any payment will be refunded.`,
        data: {
            event: 'order_cancelled',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
function orderCancelledVendorPush(orderCode, orderId) {
    return {
        title: 'Order cancelled',
        body: `Order ${orderCode} was cancelled.`,
        data: {
            event: 'order_cancelled',
            orderCode,
            ...(orderId ? { orderId, link: `/order/${orderId}` } : {}),
        },
    };
}
function orderCancelledPartnerPush(orderCode, orderId) {
    return {
        title: 'Assignment cancelled',
        body: `Your assignment for order ${orderCode} was cancelled.`,
        data: {
            event: 'order_cancelled',
            orderCode,
            ...(orderId ? { orderId, link: `/(tabs)` } : {}),
        },
    };
}
function orderCancelledAdminPush(orderCode, orderId, type = 'grocery', cancelledBy) {
    const typeLabel = type === 'food' ? 'Food' : 'Grocery';
    const byPart = cancelledBy ? ` (${cancelledBy})` : '';
    return {
        title: `❌ ${typeLabel} Order Cancelled #${orderCode}`,
        body: `Order #${orderCode} was cancelled${byPart}. Tap to view details.`,
        data: {
            event: 'order_cancelled',
            orderCode,
            type,
            ...(orderId ? { orderId, link: `/orders/${orderId}`, url: `/orders/${orderId}` } : {}),
        },
    };
}
//# sourceMappingURL=order-cancelled.js.map