import type { Db } from '../../config/database.module';
import type { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import type { AdjustWalletDto } from './dto/adjust-wallet.dto';
export declare class WalletService {
    private readonly db;
    constructor(db: Db);
    getOrCreateWallet(userId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        balance: number;
        totalEarned: number;
        totalWithdrawn: number;
        updatedAt: Date;
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
        description: string;
        type: string;
        walletId: string;
        amount: number;
        orderId: string | null;
        orderType: string | null;
        couponCode: string | null;
        metadata: unknown;
    } | null>;
    confirmCommissionOnDelivery(orderType: 'grocery' | 'food', orderId: string): Promise<void>;
    cancelPendingCommission(orderType: 'grocery' | 'food', orderId: string): Promise<void>;
    restorePendingCommission(orderType: 'grocery' | 'food', orderId: string): Promise<void>;
    requestWithdrawal(userId: string, dto: RequestWithdrawalDto): Promise<{
        success: boolean;
        message: string;
        request: {
            id: string;
            status: string;
            createdAt: Date;
            userId: string;
            walletId: string;
            amount: number;
            payoutMethod: string;
            upiId: string | null;
            bankAccount: string | null;
            bankIfsc: string | null;
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
    getUserWalletSummary(userId: string): Promise<{
        user: {
            id: string;
            name: string | null;
            phone: string | null;
            email: string | null;
            role: "customer" | "vendor" | "delivery_partner" | "admin";
            status: "active" | "suspended";
        };
        vendor: {
            id: string;
            businessName: string;
            ownerName: string;
            type: string;
        } | null;
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
    getVendorWalletSummary(vendorId: string): Promise<{
        vendor: {
            id: string;
            businessName: string;
            ownerName: string;
            type: "grocery" | "restaurant" | "both";
            shopAddress: string | null;
            userId: string;
        };
        user: {
            id: string;
            name: string | null;
            phone: string | null;
            email: string | null;
            role: "customer" | "vendor" | "delivery_partner" | "admin";
            status: "active" | "suspended";
        } | null;
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
    adjustWallet(dto: AdjustWalletDto, adminId?: string): Promise<{
        success: boolean;
        message: string;
        transaction: {
            id: string;
            status: string;
            createdAt: Date;
            userId: string;
            description: string;
            type: string;
            walletId: string;
            amount: number;
            orderId: string | null;
            orderType: string | null;
            couponCode: string | null;
            metadata: unknown;
        };
        summary: {
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
        };
    }>;
    listWallets(params: {
        role?: string;
        search?: string;
    }): Promise<{
        walletId: string | null;
        userId: string;
        userName: string;
        userPhone: string | null;
        userEmail: string | null;
        userRole: "customer" | "vendor" | "delivery_partner" | "admin";
        userStatus: "active" | "suspended";
        balance: number;
        totalEarned: number;
        totalWithdrawn: number;
        vendorId: string | null;
        businessName: string | null;
        vendorType: "grocery" | "restaurant" | "both" | null;
    }[]>;
    listAllTransactions(limit?: number): Promise<{
        id: string;
        walletId: string;
        userId: string;
        amount: number;
        type: string;
        status: string;
        description: string;
        orderId: string | null;
        orderType: string | null;
        couponCode: string | null;
        metadata: unknown;
        createdAt: Date;
        userName: string;
        userPhone: string | null;
        userRole: "customer" | "vendor" | "delivery_partner" | "admin";
        businessName: string | null;
        vendorId: string | null;
    }[]>;
}
