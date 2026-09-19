import type { Db } from '../../config/database.module';
import type { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';
export interface ResolvedRevenueConfig {
    commissionPct: number;
    deliveryFeeFlat: number;
    freeDeliveryThreshold: number;
    deliveryFeeTier1: number;
    deliveryFeeTier2: number;
    deliveryFeeTier3: number;
    codThreshold: number | null;
}
export declare class RevenueConfigService {
    private readonly db;
    constructor(db: Db);
    create(adminUserId: string, dto: CreateRevenueConfigDto): Promise<{
        id: string;
        createdAt: Date;
        commissionPct: number;
        scope: "vendor" | "global" | "category";
        scopeRefId: string | null;
        deliveryFeeFlat: number;
        freeDeliveryThreshold: number | null;
        deliveryFeeTier1: number | null;
        deliveryFeeTier2: number | null;
        deliveryFeeTier3: number | null;
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
        freeDeliveryThreshold: number | null;
        deliveryFeeTier1: number | null;
        deliveryFeeTier2: number | null;
        deliveryFeeTier3: number | null;
        codThreshold: number | null;
        notes: string | null;
        effectiveFrom: Date;
        createdBy: string | null;
        createdAt: Date;
    }[]>;
    resolve(vendorId: string, categoryId: string | null, asOf?: Date): Promise<ResolvedRevenueConfig>;
    private toResolved;
    calculateDeliveryFee(config: ResolvedRevenueConfig, subtotal: number, distanceKm: number): number;
}
