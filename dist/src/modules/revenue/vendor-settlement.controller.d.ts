import type { JwtAccessPayload } from '../auth/auth.types';
import { SettlementService } from './settlement.service';
import { VendorWithdrawalService } from './vendor-withdrawal.service';
import { RequestVendorWithdrawalDto } from './dto/vendor-withdrawal.dto';
export declare class VendorSettlementController {
    private readonly settlements;
    private readonly withdrawals;
    constructor(settlements: SettlementService, withdrawals: VendorWithdrawalService);
    list(user: JwtAccessPayload): Promise<{
        id: string;
        type: "grocery" | "food";
        orderId: string;
        orderCode: string;
        vendorPayout: number;
        deliveryPayout: number;
        platformShare: number;
        commissionPctSnapshot: number;
        createdAt: Date;
    }[]>;
    listWithdrawals(user: JwtAccessPayload): Promise<{
        minWithdrawalLimit: number;
        hasPending: boolean;
        withdrawals: {
            id: string;
            amount: number;
            status: string;
            payoutMethod: string;
            payoutDestination: string | null;
            rejectionReason: string | null;
            payoutReference: string | null;
            processedAt: Date | null;
            createdAt: Date;
        }[];
        availableBalance: number;
        totalEarned: number;
        totalWithdrawn: number;
        pendingAmount: number;
    }>;
    getWithdrawalLimit(): Promise<{
        minWithdrawalLimit: number;
    }>;
    withdraw(user: JwtAccessPayload, dto: RequestVendorWithdrawalDto): Promise<{
        success: boolean;
        message: string;
        withdrawalId: string;
        amount: number;
        availableBalance: number;
    }>;
}
