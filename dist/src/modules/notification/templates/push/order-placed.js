"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderPlacedCustomerPush = orderPlacedCustomerPush;
exports.orderPlacedVendorPush = orderPlacedVendorPush;
function orderPlacedCustomerPush(orderCode, total, orderId, type = 'grocery') {
    return {
        title: 'Order placed',
        body: `Your order ${orderCode} for ₹${total} has been placed.`,
        data: {
            event: 'order_placed',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
function orderPlacedVendorPush(orderCode, itemCount, orderId, type = 'grocery') {
    return {
        title: 'New order',
        body: `New order ${orderCode} with ${itemCount} item(s) — respond soon.`,
        data: {
            event: 'order_placed',
            orderCode,
            ...(orderId ? { orderId, type, link: `/incoming/${orderId}` } : {}),
        },
    };
}
//# sourceMappingURL=order-placed.js.map