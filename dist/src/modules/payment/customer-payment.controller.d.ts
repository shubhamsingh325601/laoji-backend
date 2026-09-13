import type { JwtAccessPayload } from '../auth/auth.types';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
export declare class CustomerPaymentController {
    private readonly payments;
    constructor(payments: PaymentService);
    initiate(user: JwtAccessPayload, type: 'grocery' | 'food', orderId: string, dto: InitiatePaymentDto): Promise<{
        amount: number;
        status: "pending" | "paid" | "failed" | "pending_cod" | "collected" | "refund_pending" | "refunded";
        upiDeepLink: string | null;
        providerRef: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        provider: "upi_deeplink" | "razorpay" | "cod";
        reconciledBy: string | null;
        reconciledAt: Date | null;
    }>;
    get(user: JwtAccessPayload, type: 'grocery' | 'food', orderId: string): Promise<{
        id: string;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        provider: "upi_deeplink" | "razorpay" | "cod";
        status: "pending" | "paid" | "failed" | "pending_cod" | "collected" | "refund_pending" | "refunded";
        amount: number;
        upiDeepLink: string | null;
        providerRef: string | null;
        reconciledBy: string | null;
        reconciledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    confirm(user: JwtAccessPayload, type: 'grocery' | 'food', orderId: string): Promise<{
        id: string;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        provider: "upi_deeplink" | "razorpay" | "cod";
        status: "pending" | "paid" | "failed" | "pending_cod" | "collected" | "refund_pending" | "refunded";
        amount: number;
        upiDeepLink: string | null;
        providerRef: string | null;
        reconciledBy: string | null;
        reconciledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
