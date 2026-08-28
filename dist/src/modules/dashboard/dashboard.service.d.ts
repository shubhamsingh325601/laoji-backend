import type { Db } from '../../config/database.module';
export interface DashboardStats {
    ordersToday: {
        grocery: number;
        food: number;
    };
    gmvToday: number;
    gmvDeltaPct: number;
    activeVendors: number;
    totalVendors: number;
    activePartners: number;
    totalPartners: number;
    pendingKyc: number;
    pendingSuggestions: number;
}
export interface AttentionItem {
    id: string;
    kind: 'stuck_order' | 'failed_allocation';
    title: string;
    detail: string;
    minutesWaiting: number;
    severity: 'warning' | 'critical';
    href: string;
}
export interface ReportSeriesPoint {
    date: string;
    grocery: number;
    food: number;
    revenue: number;
}
export interface VendorPerformanceRow {
    vendorId: string;
    vendorName: string;
    orders: number;
    gmv: number;
    acceptanceRate: number;
    avgPrepMinutes: number;
}
export interface CancellationRow {
    cause: 'customer' | 'vendor' | 'no_fulfillment';
    count: number;
}
export declare class DashboardService {
    private readonly db;
    constructor(db: Db);
    getStats(): Promise<DashboardStats>;
    getAttention(): Promise<AttentionItem[]>;
    private pushStuckIfDue;
    private latestStatusChangeMap;
    private vendorNameMap;
    private restaurantNameMap;
    getSeries(days: number): Promise<ReportSeriesPoint[]>;
    getVendorPerformance(): Promise<VendorPerformanceRow[]>;
    getCancellations(): Promise<CancellationRow[]>;
}
