"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveredCustomerPush = deliveredCustomerPush;
exports.deliveredVendorPush = deliveredVendorPush;
exports.deliveredPartnerPush = deliveredPartnerPush;
function deliveredCustomerPush(orderCode) {
    return {
        title: 'Delivered!',
        body: `Order ${orderCode} has been delivered. Enjoying it? Rate your experience.`,
        data: { event: 'delivered', orderCode },
    };
}
function deliveredVendorPush(orderCode) {
    return {
        title: 'Order complete',
        body: `Order ${orderCode} was delivered successfully.`,
        data: { event: 'delivered', orderCode },
    };
}
function deliveredPartnerPush(orderCode, payout) {
    return {
        title: 'Earnings updated',
        body: `You completed order ${orderCode} — ₹${payout} added to your earnings.`,
        data: { event: 'delivered', orderCode },
    };
}
//# sourceMappingURL=delivered.js.map