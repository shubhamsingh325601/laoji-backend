import type { Db } from '../../config/database.module';
import type { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
export declare class WalletService {
    private readonly db;
    constructor(db: Db);
    getOrCreateWallet(userId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        balance: number;
        totalEarned: number;
        totalWithdrawn: number;
    }>;
    getWalletSummary(userId: string): Promise<{
        wallet: {
            id: string;
            balance: number;
            totalEarned: number;
            totalWithdrawn: number;
            pendingEarnings: number;
        };
        transactions: {
            id: string;
            amount: number;
            type: string;
            status: string;
            description: string;
            orderId: string | null;
            orderType: string | null;
            couponCode: string | null;
            createdAt: Date;
        }[];
        withdrawals: {
            id: string;
            amount: number;
            payoutMethod: string;
            upiId: string | null;
            bankAccount: string | null;
            bankIfsc: string | null;
            status: string;
            adminNotes: string | null;
            processedAt: Date | null;
            createdAt: Date;
        }[];
    }>;
    recordPendingCommission(params: {
        userId: string;
        amount: number;
        orderId: string;
        orderType: 'grocery' | 'food';
        couponCode: string;
    }): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        userId: string;
        type: string;
        description: string;
        couponCode: string | null;
        amount: number;
        orderId: string | null;
        walletId: string;
        orderType: string | null;
        metadata: unknown;
    } | null>;
    confirmCommissionOnDelivery(orderType: 'grocery' | 'food', orderId: string): Promise<void>;
    cancelPendingCommission(orderType: 'grocery' | 'food', orderId: string): Promise<void>;
    requestWithdrawal(userId: string, dto: RequestWithdrawalDto): Promise<{
        success: boolean;
        message: string;
        request: {
            id: string;
            status: string;
            createdAt: Date;
            userId: string;
            bankAccount: string | null;
            bankIfsc: string | null;
            upiId: string | null;
            amount: number;
            walletId: string;
            payoutMethod: string;
            accountHolderName: string | null;
            adminNotes: string | null;
            processedAt: Date | null;
        };
    }>;
    listAllWithdrawalRequests(status?: string): Promise<{
        id: string;
        userId: string;
        walletId: string;
        amount: number;
        payoutMethod: string;
        upiId: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        accountHolderName: string | null;
        status: string;
        adminNotes: string | null;
        processedAt: Date | null;
        createdAt: Date;
        userName: string | null;
        userPhone: string | null;
        userEmail: string | null;
        userRole: "customer" | "vendor" | "delivery_partner" | "admin" | null;
    }[]>;
    approveWithdrawal(requestId: string, adminNotes?: string): Promise<{
        id: string;
        userId: string;
        walletId: string;
        amount: number;
        payoutMethod: string;
        upiId: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        accountHolderName: string | null;
        status: string;
        adminNotes: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
    rejectWithdrawal(requestId: string, adminNotes?: string): Promise<{
        id: string;
        userId: string;
        walletId: string;
        amount: number;
        payoutMethod: string;
        upiId: string | null;
        bankAccount: string | null;
        bankIfsc: string | null;
        accountHolderName: string | null;
        status: string;
        adminNotes: string | null;
        processedAt: Date | null;
        createdAt: Date;
    }>;
}
