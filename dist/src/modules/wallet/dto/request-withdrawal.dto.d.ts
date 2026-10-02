export declare class RequestWithdrawalDto {
    amount: number;
    payoutMethod: 'upi' | 'bank';
    upiId?: string;
    bankAccount?: string;
    bankIfsc?: string;
    accountHolderName?: string;
}
export declare class ProcessWithdrawalDto {
    adminNotes?: string;
}
