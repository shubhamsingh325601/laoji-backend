"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalApprovedVendorPush = withdrawalApprovedVendorPush;
exports.withdrawalRejectedVendorPush = withdrawalRejectedVendorPush;
exports.withdrawalRequestedAdminPush = withdrawalRequestedAdminPush;
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
function withdrawalRequestedAdminPush(businessName, amount, withdrawalId) {
    return {
        title: '💸 New Withdrawal Request',
        body: `${businessName} requested a payout of ₹${amount}. Tap to review and process.`,
        data: {
            event: 'withdrawal_requested',
            amount: String(amount),
            ...(withdrawalId ? { withdrawalId, link: `/withdrawals/${withdrawalId}`, url: `/withdrawals/${withdrawalId}` } : {}),
        },
    };
}
//# sourceMappingURL=vendor-withdrawal.js.map