"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalApprovedVendorPush = withdrawalApprovedVendorPush;
exports.withdrawalRejectedVendorPush = withdrawalRejectedVendorPush;
function withdrawalApprovedVendorPush(amount) {
    return {
        title: 'Withdrawal approved',
        body: `₹${amount} is on its way to your registered account.`,
        data: { event: 'withdrawal_approved', screen: '/(tabs)/earnings' },
    };
}
function withdrawalRejectedVendorPush(amount, reason) {
    return {
        title: 'Withdrawal rejected',
        body: `Your ₹${amount} withdrawal request was rejected: ${reason}`,
        data: { event: 'withdrawal_rejected', screen: '/(tabs)/earnings' },
    };
}
//# sourceMappingURL=vendor-withdrawal.js.map