export declare const PAYMENT_METHODS: readonly ["online", "cod", "wallet"];
export declare class InitiatePaymentDto {
    method: (typeof PAYMENT_METHODS)[number];
    useWallet?: boolean;
}
