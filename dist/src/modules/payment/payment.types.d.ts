export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'pending_cod' | 'collected' | 'refund_pending' | 'refunded';
export interface PaymentInitiateParams {
    orderId: string;
    amount: number;
}
export interface PaymentInitiateResult {
    status: PaymentStatus;
    upiDeepLink?: string;
    providerRef?: string;
}
export interface PaymentVerifyParams {
    providerRef: string;
    currentStatus: PaymentStatus;
}
export interface PaymentVerifyResult {
    status: PaymentStatus;
}
export interface PaymentRefundParams {
    providerRef: string;
    amount: number;
}
export interface PaymentRefundResult {
    status: 'refunded' | 'failed';
}
export interface PaymentProvider {
    initiate(params: PaymentInitiateParams): Promise<PaymentInitiateResult>;
    verify(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
    refund(params: PaymentRefundParams): Promise<PaymentRefundResult>;
}
