"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentOfferedPartnerPush = assignmentOfferedPartnerPush;
function assignmentOfferedPartnerPush(orderCode, payout, orderId) {
    return {
        title: 'New delivery assignment',
        body: `Order ${orderCode} is ready for pickup — ₹${payout} payout.`,
        data: {
            event: 'assignment_offered',
            orderCode,
            ...(orderId ? { orderId, link: `/orders` } : {}),
        },
    };
}
//# sourceMappingURL=ready-for-pickup.js.map