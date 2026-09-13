"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryAssignedCustomerPush = deliveryAssignedCustomerPush;
function deliveryAssignedCustomerPush(orderCode, orderId, type = 'grocery') {
    return {
        title: 'Delivery partner on the way',
        body: `A delivery partner has been assigned to order ${orderCode}. Track it live in the app.`,
        data: {
            event: 'delivery_assigned',
            orderCode,
            ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
        },
    };
}
//# sourceMappingURL=delivery-assigned.js.map