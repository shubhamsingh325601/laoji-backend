import type { JwtAccessPayload } from '../auth/auth.types';
import { RevenueConfigService } from './revenue-config.service';
import { SettlementService } from './settlement.service';
import { RiderPayoutService } from './rider-payout.service';
import { NewCustomerDeliveryService } from './new-customer-delivery.service';
import { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';
declare class SetRiderPayoutTiersDto {
    tiers: unknown[];
}
export declare class AdminRevenueController {
    private readonly revenueConfig;
    private readonly settlements;
    private readonly riderPayout;
    private readonly newCustomerDelivery;
    constructor(revenueConfig: RevenueConfigService, settlements: SettlementService, riderPayout: RiderPayoutService, newCustomerDelivery: NewCustomerDeliveryService);
    create(user: JwtAccessPayload, dto: CreateRevenueConfigDto): Promise<{
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
        minOrderValue: number | null;
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
        minOrderValue: number | null;
        codThreshold: number | null;
        notes: string | null;
        effectiveFrom: Date;
        createdBy: string | null;
        createdAt: Date;
    }[]>;
    listRiderPayoutTiers(): Promise<{
        tiers: import("./rider-payout.service").RiderPayoutTier[];
    }>;
    setRiderPayoutTiers(dto: SetRiderPayoutTiersDto): Promise<{
        tiers: import("./rider-payout.service").RiderPayoutTier[];
    }>;
    getNewCustomerDelivery(): Promise<import("./new-customer-delivery.service").NewCustomerDeliverySettings>;
    setNewCustomerDelivery(body: unknown): Promise<import("./new-customer-delivery.service").NewCustomerDeliverySettings>;
    listFreeDeliveryCustomers(search?: string): Promise<{
        settings: import("./new-customer-delivery.service").NewCustomerDeliverySettings;
        customers: import("./new-customer-delivery.service").CustomerFreeDeliveryStatus[];
    }>;
    setFreeDeliveryExtra(customerId: string, body: {
        extraOrders?: unknown;
    }): Promise<import("./new-customer-delivery.service").CustomerFreeDeliveryStatus>;
    listDeliveryFeeTiers(): Promise<{
        tiers: import("./rider-payout.service").RiderPayoutTier[];
    }>;
    setDeliveryFeeTiers(dto: SetRiderPayoutTiersDto): Promise<{
        tiers: import("./rider-payout.service").RiderPayoutTier[];
    }>;
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
export {};
