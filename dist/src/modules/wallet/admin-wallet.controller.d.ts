import type { JwtAccessPayload } from '../auth/auth.types';
import { WalletService } from './wallet.service';
import { ProcessWithdrawalDto } from './dto/request-withdrawal.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
export declare class AdminWalletController {
    private readonly wallet;
    constructor(wallet: WalletService);
    listWallets(role?: string, search?: string): Promise<{
        walletId: string | null;
        userId: string;
        userName: string;
        userPhone: string | null;
        userEmail: string | null;
        userRole: "vendor" | "customer" | "delivery_partner" | "admin";
        userStatus: "active" | "suspended";
        balance: number;
        totalEarned: number;
        totalWithdrawn: number;
        vendorId: string | null;
        businessName: string | null;
        vendorType: "grocery" | "restaurant" | "both" | null;
    }[]>;
    listTransactions(limit?: string): Promise<{
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
        userRole: "vendor" | "customer" | "delivery_partner" | "admin";
        businessName: string | null;
        vendorId: string | null;
    }[]>;
    getUserWallet(userId: string): Promise<{
        user: {
            id: string;
            name: string | null;
            phone: string | null;
            email: string | null;
            role: "vendor" | "customer" | "delivery_partner" | "admin";
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
    getVendorWallet(vendorId: string): Promise<{
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
            role: "vendor" | "customer" | "delivery_partner" | "admin";
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
    adjustWallet(dto: AdjustWalletDto, admin?: JwtAccessPayload): Promise<{
        success: boolean;
        message: string;
        transaction: {
            amount: number;
            id: string;
            status: string;
            createdAt: Date;
            userId: string;
            description: string;
            type: string;
            walletId: string;
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
    listRequests(status?: string): Promise<{
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
        userRole: "vendor" | "customer" | "delivery_partner" | "admin" | null;
    }[]>;
    approveRequest(id: string, dto: ProcessWithdrawalDto): Promise<{
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
    rejectRequest(id: string, dto: ProcessWithdrawalDto): Promise<{
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
