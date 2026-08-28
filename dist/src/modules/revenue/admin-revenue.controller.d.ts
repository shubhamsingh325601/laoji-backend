import type { JwtAccessPayload } from '../auth/auth.types';
import { RevenueConfigService } from './revenue-config.service';
import { SettlementService } from './settlement.service';
import { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';
export declare class AdminRevenueController {
    private readonly revenueConfig;
    private readonly settlements;
    constructor(revenueConfig: RevenueConfigService, settlements: SettlementService);
    create(user: JwtAccessPayload, dto: CreateRevenueConfigDto): Promise<{
        id: string;
        createdAt: Date;
        commissionPct: number;
        scope: "vendor" | "global" | "category";
        scopeRefId: string | null;
        deliveryFeeFlat: number;
        codThreshold: number | null;
        notes: string | null;
        effectiveFrom: Date;
        createdBy: string | null;
    }>;
    listAll(): Promise<{
        createdByLabel: string;
        id: string;
        scope: "vendor" | "global" | "category";
        scopeRefId: string | null;
        commissionPct: number;
        deliveryFeeFlat: number;
        codThreshold: number | null;
        notes: string | null;
        effectiveFrom: Date;
        createdBy: string | null;
        createdAt: Date;
    }[]>;
    listSettlements(): Promise<{
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
}
