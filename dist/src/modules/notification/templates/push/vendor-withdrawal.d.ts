import type { PushMessage } from '../../notification.types';
export declare function withdrawalApprovedVendorPush(amount: number): PushMessage;
export declare function withdrawalRejectedVendorPush(amount: number, reason: string): PushMessage;
export declare function withdrawalRequestedAdminPush(businessName: string, amount: number, withdrawalId?: string): PushMessage;
