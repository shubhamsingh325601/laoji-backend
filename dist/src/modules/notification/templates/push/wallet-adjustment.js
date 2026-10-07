"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletAdjustedPush = walletAdjustedPush;
function walletAdjustedPush(params) {
    const isCredit = params.action === 'credit';
    const title = isCredit
        ? `₹${params.amount} credited to your wallet`
        : `₹${params.amount} debited from your wallet`;
    const reasonText = params.reason ? ` Reason: ${params.reason}.` : '';
    const body = isCredit
        ? `₹${params.amount} has been added to your Laoji Wallet.${reasonText} Available balance: ₹${params.newBalance}`
        : `₹${params.amount} has been deducted from your Laoji Wallet.${reasonText} Available balance: ₹${params.newBalance}`;
    return {
        title,
        body,
        data: {
            event: isCredit ? 'wallet_credited' : 'wallet_debited',
            amount: String(params.amount),
            newBalance: String(params.newBalance),
            screen: params.role === 'vendor' ? '/(tabs)/earnings' : '/wallet',
        },
    };
}
//# sourceMappingURL=wallet-adjustment.js.map