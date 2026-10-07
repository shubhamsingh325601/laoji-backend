import type { Db } from '../../config/database.module';
type OrderType = 'grocery' | 'food';
export interface RiderPayoutTier {
    fromKm: number;
    toKm: number | null;
    amount: number;
}
export declare const DEFAULT_RIDER_PAYOUT_TIERS: RiderPayoutTier[];
export declare function validateRiderPayoutTiers(tiers: unknown): RiderPayoutTier[];
export declare function riderPayoutForDistance(tiers: RiderPayoutTier[], distanceKm: number): number;
export declare class RiderPayoutService {
    private readonly db;
    constructor(db: Db);
    listTiers(): Promise<RiderPayoutTier[]>;
    replaceTiers(tiers: unknown): Promise<RiderPayoutTier[]>;
    forOrder(type: OrderType, orderId: string): Promise<number>;
    private pickupToDropKm;
}
export {};
