export declare class AdjustWalletDto {
    userId?: string;
    vendorId?: string;
    action: 'credit' | 'debit';
    amount: number;
    description: string;
}
