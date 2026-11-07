import type { JwtAccessPayload } from '../auth/auth.types';
import { PaymentService } from './payment.service';
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
export declare class AdminPaymentController {
    private readonly payments;
    constructor(payments: PaymentService);
    getSettings(): Promise<{
        upiId: string;
        payeeName: string;
    }>;
    updateSettings(user: JwtAccessPayload, dto: UpdatePaymentSettingsDto): Promise<{
        upiId: string;
        payeeName: string;
        message: string;
    }>;
    putSettings(user: JwtAccessPayload, dto: UpdatePaymentSettingsDto): Promise<{
        upiId: string;
        payeeName: string;
        message: string;
    }>;
    listPending(): Promise<{
        id: string;
        type: import("./payment.service").OrderType;
        orderId: string;
        orderCode: string;
        provider: "upi_deeplink" | "cod" | "razorpay" | "wallet";
        amount: number;
        upiDeepLink: string | null;
        customerPhone: string;
        createdAt: Date;
    }[]>;
    reconcile(user: JwtAccessPayload, id: string, dto: ReconcilePaymentDto): Promise<{
        id: string;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        provider: "upi_deeplink" | "cod" | "razorpay" | "wallet";
        status: "pending" | "failed" | "paid" | "pending_cod" | "collected" | "refund_pending" | "refunded";
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
        provider: "upi_deeplink" | "cod" | "razorpay" | "wallet";
        amount: number;
        upiDeepLink: string | null;
        customerPhone: string;
        createdAt: Date;
    }[]>;
    markRefunded(user: JwtAccessPayload, id: string): Promise<{
        id: string;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        provider: "upi_deeplink" | "cod" | "razorpay" | "wallet";
        status: "pending" | "failed" | "paid" | "pending_cod" | "collected" | "refund_pending" | "refunded";
        amount: number;
        upiDeepLink: string | null;
        providerRef: string | null;
        reconciledBy: string | null;
        reconciledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
