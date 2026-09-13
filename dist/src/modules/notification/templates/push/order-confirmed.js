"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderConfirmedCustomerPush = orderConfirmedCustomerPush;
function orderConfirmedCustomerPush(orderCode, orderId, type = 'grocery') {
    return {
        title: 'Order confirmed',
        body: `Your order ${orderCode} has been confirmed and is being prepared.`,
        data: {
            event: 'order_confirmed',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
//# sourceMappingURL=order-confirmed.js.map