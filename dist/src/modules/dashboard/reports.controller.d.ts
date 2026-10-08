import { DashboardService } from './dashboard.service';
export declare class ReportsController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    series(daysRaw?: string): Promise<import("./dashboard.service").ReportSeriesPoint[]>;
    vendorPerformance(): Promise<import("./dashboard.service").VendorPerformanceRow[]>;
    vendorSummary(id: string, from?: string, to?: string): Promise<{
        acceptanceRate: number | null;
        avgPrepMinutes: number | null;
        totalOrders: number;
        deliveredOrders: number;
        cancelledOrders: number;
        grossSales: number;
        vendorEarnings: number;
        platformEarnings: number;
        totalWithdrawn: number;
        pendingWithdrawal: number;
        remainingBalance: number;
        availableBalance: number;
    }>;
    cancellations(): Promise<import("./dashboard.service").CancellationRow[]>;
}
