import { ConfigService } from '@nestjs/config';
import type { Db } from '../../../config/database.module';
import type { PaymentInitiateParams, PaymentInitiateResult, PaymentProvider, PaymentRefundParams, PaymentRefundResult, PaymentVerifyParams, PaymentVerifyResult } from '../payment.types';
export declare const PLATFORM_KEY_CUSTOMER_UPI_VPA = "customer_upi_vpa";
export declare const PLATFORM_KEY_CUSTOMER_UPI_PAYEE = "customer_upi_payee_name";
export declare class UpiDeepLinkProvider implements PaymentProvider {
    private readonly config;
    private readonly db?;
    constructor(config: ConfigService, db?: Db | undefined);
    initiate({ orderId, amount }: PaymentInitiateParams): Promise<PaymentInitiateResult>;
    verify(_params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
    refund(_params: PaymentRefundParams): Promise<PaymentRefundResult>;
}
