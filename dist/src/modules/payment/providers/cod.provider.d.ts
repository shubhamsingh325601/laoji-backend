import type { PaymentInitiateParams, PaymentInitiateResult, PaymentProvider, PaymentRefundParams, PaymentRefundResult, PaymentVerifyParams, PaymentVerifyResult } from '../payment.types';
export declare class CodProvider implements PaymentProvider {
    initiate(_params: PaymentInitiateParams): Promise<PaymentInitiateResult>;
    verify({ currentStatus }: PaymentVerifyParams): Promise<PaymentVerifyResult>;
    refund(_params: PaymentRefundParams): Promise<PaymentRefundResult>;
}
