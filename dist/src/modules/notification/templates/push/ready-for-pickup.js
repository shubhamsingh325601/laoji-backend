"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentOfferedPartnerPush = assignmentOfferedPartnerPush;
function assignmentOfferedPartnerPush(orderCode, payout) {
    return {
        title: 'New delivery assignment',
        body: `Order ${orderCode} is ready for pickup — ₹${payout} payout.`,
        data: { event: 'assignment_offered', orderCode },
    };
}
//# sourceMappingURL=ready-for-pickup.js.map