import type { Db } from '../../config/database.module';
import { NotificationService } from '../notification/notification.service';
type OrderType = 'grocery' | 'food';
export declare class VendorWithdrawalService {
    private readonly db;
    private readonly notifications;
    constructor(db: Db, notifications: NotificationService);
    private totalEarned;
    getBalance(vendorId: string): Promise<{
        availableBalance: number;
        totalEarned: number;
        totalWithdrawn: number;
        pendingAmount: number;
    }>;
    private vendorForUser;
    listForVendor(userId: string): Promise<{
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
    request(userId: string, requested?: number): Promise<{
        success: boolean;
        message: string;
        withdrawalId: string;
        amount: number;
        availableBalance: number;
    }>;
    listForAdmin(status?: string): Promise<{
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
    getForAdmin(id: string): Promise<{
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
            type: OrderType;
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
            type: OrderType;
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
    approve(id: string, adminId: string, payoutReference?: string): Promise<{
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
    reject(id: string, adminId: string, reason: string): Promise<{
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
    private throwNotPending;
    private notifyVendor;
    private toAdminSummary;
    private ordersInPeriod;
    private terminalTimes;
}
export {};
