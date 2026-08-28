"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderCancelledCustomerPush = orderCancelledCustomerPush;
exports.orderCancelledVendorPush = orderCancelledVendorPush;
exports.orderCancelledPartnerPush = orderCancelledPartnerPush;
function orderCancelledCustomerPush(orderCode) {
    return {
        title: 'Order cancelled',
        body: `Order ${orderCode} could not be completed and has been cancelled. Any payment will be refunded.`,
        data: { event: 'order_cancelled', orderCode },
    };
}
function orderCancelledVendorPush(orderCode) {
    return {
        title: 'Order cancelled',
        body: `Order ${orderCode} was cancelled.`,
        data: { event: 'order_cancelled', orderCode },
    };
}
function orderCancelledPartnerPush(orderCode) {
    return {
        title: 'Assignment cancelled',
        body: `Your assignment for order ${orderCode} was cancelled.`,
        data: { event: 'order_cancelled', orderCode },
    };
}
//# sourceMappingURL=order-cancelled.js.map