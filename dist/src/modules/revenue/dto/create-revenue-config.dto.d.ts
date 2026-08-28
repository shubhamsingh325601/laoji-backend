export declare const REVENUE_CONFIG_SCOPES: readonly ["global", "category", "vendor"];
export declare class CreateRevenueConfigDto {
    scope: (typeof REVENUE_CONFIG_SCOPES)[number];
    scopeRefId?: string;
    commissionPct: number;
    deliveryFeeFlat: number;
    codThreshold?: number;
    notes?: string;
    effectiveFrom: string;
}
