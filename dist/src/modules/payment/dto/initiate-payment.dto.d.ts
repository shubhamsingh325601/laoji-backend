export declare const PAYMENT_METHODS: readonly ["online", "cod"];
export declare class InitiatePaymentDto {
    method: (typeof PAYMENT_METHODS)[number];
}
