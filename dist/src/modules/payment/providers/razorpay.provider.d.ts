import type { PaymentInitiateParams, PaymentInitiateResult, PaymentProvider, PaymentRefundParams, PaymentRefundResult, PaymentVerifyParams, PaymentVerifyResult } from '../payment.types';
export declare class RazorpayProvider implements PaymentProvider {
    initiate(_params: PaymentInitiateParams): Promise<PaymentInitiateResult>;
    verify(_params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
    refund(_params: PaymentRefundParams): Promise<PaymentRefundResult>;
}
