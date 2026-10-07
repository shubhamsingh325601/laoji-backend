import type { PushMessage } from '../../notification.types';
export declare function walletAdjustedPush(params: {
    action: 'credit' | 'debit';
    amount: number;
    newBalance: number;
    reason?: string;
    role?: string;
}): PushMessage;
