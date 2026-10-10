import type { Db } from '../../config/database.module';
import { type RiderPayoutTier } from './rider-payout.service';
export interface NewCustomerDeliverySettings {
    enabled: boolean;
    maxKm: number;
    maxOrders: number;
}
export type DeliveryFeeTier = RiderPayoutTier;
export declare const DEFAULT_NEW_CUSTOMER_DELIVERY: NewCustomerDeliverySettings;
export interface FreeDeliveryOffer {
    applied: boolean;
    remaining: number;
}
export interface CustomerFreeDeliveryStatus {
    customerId: string;
    name: string | null;
    phone: string | null;
    ordersPlaced: number;
    allowed: number;
    extraGranted: number;
    remaining: number;
}
export declare function validateNewCustomerDelivery(input: unknown): NewCustomerDeliverySettings;
export declare class NewCustomerDeliveryService {
    private readonly db;
    constructor(db: Db);
    get(): Promise<NewCustomerDeliverySettings>;
    save(input: unknown): Promise<NewCustomerDeliverySettings>;
    listFeeTiers(): Promise<DeliveryFeeTier[]>;
    replaceFeeTiers(tiers: unknown): Promise<DeliveryFeeTier[]>;
    feeForDistance(distanceKm: number): Promise<number | null>;
    private ordersPlaced;
    private extras;
    offerFor(customerId: string, distanceKm: number): Promise<FreeDeliveryOffer>;
    listCustomers(search?: string): Promise<{
        settings: NewCustomerDeliverySettings;
        customers: CustomerFreeDeliveryStatus[];
    }>;
    private statuses;
    setExtra(customerId: string, extraOrders: unknown): Promise<CustomerFreeDeliveryStatus>;
}
