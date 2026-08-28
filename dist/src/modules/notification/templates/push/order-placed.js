"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderPlacedCustomerPush = orderPlacedCustomerPush;
exports.orderPlacedVendorPush = orderPlacedVendorPush;
function orderPlacedCustomerPush(orderCode, total) {
    return {
        title: 'Order placed',
        body: `Your order ${orderCode} for ₹${total} has been placed.`,
        data: { event: 'order_placed', orderCode },
    };
}
function orderPlacedVendorPush(orderCode, itemCount) {
    return {
        title: 'New order',
        body: `New order ${orderCode} with ${itemCount} item(s) — respond soon.`,
        data: { event: 'order_placed', orderCode },
    };
}
//# sourceMappingURL=order-placed.js.map