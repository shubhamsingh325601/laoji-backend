import type { PushMessage } from '../../notification.types';

// See VendorWithdrawalService.approve / reject. `screen` opens the Vendor
// app's Earnings tab when tapped.
export function withdrawalApprovedVendorPush(amount: number): PushMessage {
  return {
    title: 'Withdrawal approved',
    body: `₹${amount} is on its way to your registered account.`,
    data: { event: 'withdrawal_approved', screen: '/(tabs)/earnings' },
  };
}

export function withdrawalRejectedVendorPush(amount: number, reason: string): PushMessage {
  return {
    title: 'Withdrawal rejected',
    body: `Your ₹${amount} withdrawal request was rejected: ${reason}`,
    data: { event: 'withdrawal_rejected', screen: '/(tabs)/earnings' },
  };
}

export function withdrawalRequestedAdminPush(
  businessName: string,
  amount: number,
  withdrawalId?: string,
): PushMessage {
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

