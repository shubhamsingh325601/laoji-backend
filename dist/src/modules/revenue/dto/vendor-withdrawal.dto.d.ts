export declare class RequestVendorWithdrawalDto {
    amount?: number;
}
export declare class ApproveWithdrawalDto {
    payoutReference?: string;
}
export declare class RejectWithdrawalDto {
    reason: string;
}
export declare class UpdateWithdrawalSettingsDto {
    minWithdrawalLimit: number;
}
