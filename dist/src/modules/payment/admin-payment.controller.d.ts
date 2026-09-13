import type { JwtAccessPayload } from '../auth/auth.types';
import { PaymentService } from './payment.service';
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';
export declare class AdminPaymentController {
    private readonly payments;
    constructor(payments: PaymentService);
    listPending(): Promise<{
        id: string;
        type: import("./payment.service").OrderType;
        orderId: string;
        orderCode: string;
        provider: "upi_deeplink" | "razorpay" | "cod";
        amount: number;
        upiDeepLink: string | null;
        customerPhone: string;
        createdAt: Date;
    }[]>;
    reconcile(user: JwtAccessPayload, id: string, dto: ReconcilePaymentDto): Promise<{
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
    listRefunds(): Promise<{
        id: string;
        type: import("./payment.service").OrderType;
        orderId: string;
        orderCode: string;
        provider: "upi_deeplink" | "razorpay" | "cod";
        amount: number;
        upiDeepLink: string | null;
        customerPhone: string;
        createdAt: Date;
    }[]>;
    markRefunded(user: JwtAccessPayload, id: string): Promise<{
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
