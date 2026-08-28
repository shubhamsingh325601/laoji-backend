import type { Db } from '../../config/database.module';
type OrderType = 'grocery' | 'food';
export declare class SettlementService {
    private readonly db;
    constructor(db: Db);
    vendorIdForUser(userId: string): Promise<string>;
    partnerIdForUser(userId: string): Promise<string>;
    generateForDeliveredOrder(type: OrderType, orderId: string): Promise<{
        id: string;
        createdAt: Date;
        groceryOrderId: string | null;
        foodOrderId: string | null;
        vendorPayout: number;
        deliveryPayout: number;
        platformShare: number;
        commissionPctSnapshot: number;
    } | null>;
    listForVendor(vendorId: string): Promise<{
        id: string;
        type: OrderType;
        orderId: string;
        orderCode: string;
        vendorPayout: number;
        deliveryPayout: number;
        platformShare: number;
        commissionPctSnapshot: number;
        createdAt: Date;
    }[]>;
    listForPartner(partnerId: string): Promise<{
        id: string;
        type: OrderType;
        orderId: string;
        orderCode: string;
        vendorPayout: number;
        deliveryPayout: number;
        platformShare: number;
        commissionPctSnapshot: number;
        createdAt: Date;
    }[]>;
    private toSummary;
    requestVendorWithdrawal(userId: string): Promise<{
        success: boolean;
        message: string;
        availableBalance: number;
        kycStatus: "verified";
    }>;
    requestPartnerWithdrawal(userId: string): Promise<{
        success: boolean;
        message: string;
        availableBalance: number;
        kycStatus: "verified";
    }>;
    listAllForAdmin(): Promise<{
        id: string;
        type: OrderType;
        orderId: string;
        orderCode: string;
        vendorPayout: number;
        deliveryPayout: number;
        platformShare: number;
        commissionPctSnapshot: number;
        createdAt: Date;
    }[]>;
}
export {};
