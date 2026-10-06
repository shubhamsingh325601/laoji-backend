"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderPlacedCustomerPush = orderPlacedCustomerPush;
exports.orderPlacedVendorPush = orderPlacedVendorPush;
exports.orderPlacedAdminPush = orderPlacedAdminPush;
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
function orderPlacedAdminPush(orderCode, total, type = 'grocery', orderId, customerName) {
    const typeLabel = type === 'food' ? 'Food' : 'Grocery';
    const customerPart = customerName ? ` from ${customerName}` : '';
    return {
        title: `🛍️ New ${typeLabel} Order #${orderCode}`,
        body: `New ${typeLabel.toLowerCase()} order${customerPart} for ₹${total} received. Tap to view.`,
        imageUrl: undefined,
        data: {
            event: 'order_placed',
            orderCode,
            total: String(total),
            type,
            ...(orderId ? { orderId, link: `/orders/${orderId}`, url: `/orders/${orderId}` } : {}),
        },
    };
}
//# sourceMappingURL=order-placed.js.map