import type { JwtAccessPayload } from '../auth/auth.types';
import { VendorWithdrawalService } from './vendor-withdrawal.service';
import { ApproveWithdrawalDto, RejectWithdrawalDto, UpdateWithdrawalSettingsDto } from './dto/vendor-withdrawal.dto';
export declare class AdminWithdrawalController {
    private readonly withdrawals;
    constructor(withdrawals: VendorWithdrawalService);
    getSettings(): Promise<{
        minWithdrawalLimit: number;
    }>;
    updateSettings(user: JwtAccessPayload, dto: UpdateWithdrawalSettingsDto): Promise<{
        minWithdrawalLimit: number;
        message: string;
    }>;
    list(status?: string): Promise<{
        vendor: {
            id: string;
            businessName: string;
            ownerName: string;
            phone: string | null;
        };
        id: string;
        status: string;
        amount: number;
        availableBefore: number;
        payoutMethod: string;
        payoutDestination: string | null;
        periodStart: Date | null;
        periodEnd: Date;
        rejectionReason: string | null;
        payoutReference: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }[]>;
    get(id: string): Promise<{
        vendor: {
            id: string;
            businessName: string;
            ownerName: string;
            phone: string | null;
        };
        payout: {
            method: string;
            upiId: string | null;
            bankAccount: string | null;
            bankIfsc: string | null;
        };
        summary: {
            delivered: {
                count: number;
                sales: number;
                commission: number;
                net: number;
            };
            cancelled: {
                count: number;
                value: number;
            };
            carriedOver: number;
            availableBefore: number;
            requested: number;
            remainingAfter: number;
        };
        orders: ({
            type: "grocery" | "food";
            orderId: string;
            orderCode: string;
            status: "delivered";
            at: Date;
            subtotal: number;
            orderTotal: number;
            commission: number;
            vendorPayout: number;
            paymentStatus: string;
        } | {
            type: "grocery" | "food";
            orderId: string;
            orderCode: string;
            status: "cancelled" | "failed";
            at: Date;
            subtotal: number;
            orderTotal: number;
            commission: number;
            vendorPayout: number;
            paymentStatus: string;
        })[];
        id: string;
        status: string;
        amount: number;
        availableBefore: number;
        payoutMethod: string;
        payoutDestination: string | null;
        periodStart: Date | null;
        periodEnd: Date;
        rejectionReason: string | null;
        payoutReference: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
    approve(user: JwtAccessPayload, id: string, dto: ApproveWithdrawalDto): Promise<{
        id: string;
        status: string;
        amount: number;
        availableBefore: number;
        payoutMethod: string;
        payoutDestination: string | null;
        periodStart: Date | null;
        periodEnd: Date;
        rejectionReason: string | null;
        payoutReference: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
    reject(user: JwtAccessPayload, id: string, dto: RejectWithdrawalDto): Promise<{
        id: string;
        status: string;
        amount: number;
        availableBefore: number;
        payoutMethod: string;
        payoutDestination: string | null;
        periodStart: Date | null;
        periodEnd: Date;
        rejectionReason: string | null;
        payoutReference: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
}
