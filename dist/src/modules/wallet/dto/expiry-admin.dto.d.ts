export declare class RestoreScratchCardDto {
    validityDays?: number;
    notes?: string;
}
export declare class AdjustScratchCardExpiryDto {
    expiresAt?: string;
    validityDays?: number;
    notes?: string;
}
export declare class RestoreWalletCreditDto {
    validityDays?: number;
    amount?: number;
    notes?: string;
}
export declare class AdjustWalletCreditExpiryDto {
    expiresAt?: string;
    validityDays?: number;
    notes?: string;
}
export declare class UpdateExpirySettingsDto {
    scratchCardExpiryDays: number;
    walletAmountExpiryDays: number;
}
