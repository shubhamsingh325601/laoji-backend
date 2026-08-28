import { ConfigService } from '@nestjs/config';
import type { PaymentInitiateParams, PaymentInitiateResult, PaymentProvider, PaymentRefundParams, PaymentRefundResult, PaymentVerifyParams, PaymentVerifyResult } from '../payment.types';
export declare class UpiDeepLinkProvider implements PaymentProvider {
    private readonly config;
    constructor(config: ConfigService);
    initiate({ orderId, amount }: PaymentInitiateParams): Promise<PaymentInitiateResult>;
    verify(_params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
    refund(_params: PaymentRefundParams): Promise<PaymentRefundResult>;
}
