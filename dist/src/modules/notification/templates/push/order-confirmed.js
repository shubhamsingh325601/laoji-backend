"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderConfirmedCustomerPush = orderConfirmedCustomerPush;
function orderConfirmedCustomerPush(orderCode) {
    return {
        title: 'Order confirmed',
        body: `Your order ${orderCode} has been confirmed and is being prepared.`,
        data: { event: 'order_confirmed', orderCode },
    };
}
//# sourceMappingURL=order-confirmed.js.map