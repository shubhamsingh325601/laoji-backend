import type { JwtAccessPayload } from '../auth/auth.types';
import { SettlementService } from './settlement.service';
export declare class VendorSettlementController {
    private readonly settlements;
    constructor(settlements: SettlementService);
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
    withdraw(user: JwtAccessPayload): Promise<{
        success: boolean;
        message: string;
        availableBalance: number;
        kycStatus: "verified";
    }>;
}
