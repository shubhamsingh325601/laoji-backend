"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickedUpCustomerPush = pickedUpCustomerPush;
exports.pickedUpVendorPush = pickedUpVendorPush;
function pickedUpCustomerPush(orderCode, orderId, type = 'grocery') {
    return {
        title: 'Order picked up',
        body: `Order ${orderCode} has been picked up and is on its way.`,
        data: {
            event: 'picked_up',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
function pickedUpVendorPush(orderCode, orderId) {
    return {
        title: 'Handover confirmed',
        body: `Order ${orderCode} was picked up by the delivery partner.`,
        data: {
            event: 'picked_up',
            orderCode,
            ...(orderId ? { orderId, link: `/order/${orderId}` } : {}),
        },
    };
}
//# sourceMappingURL=picked-up.js.map