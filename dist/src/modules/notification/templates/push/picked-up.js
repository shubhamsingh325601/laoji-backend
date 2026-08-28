"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickedUpCustomerPush = pickedUpCustomerPush;
exports.pickedUpVendorPush = pickedUpVendorPush;
function pickedUpCustomerPush(orderCode) {
    return {
        title: 'Order picked up',
        body: `Order ${orderCode} has been picked up and is on its way.`,
        data: { event: 'picked_up', orderCode },
    };
}
function pickedUpVendorPush(orderCode) {
    return {
        title: 'Handover confirmed',
        body: `Order ${orderCode} was picked up by the delivery partner.`,
        data: { event: 'picked_up', orderCode },
    };
}
//# sourceMappingURL=picked-up.js.map