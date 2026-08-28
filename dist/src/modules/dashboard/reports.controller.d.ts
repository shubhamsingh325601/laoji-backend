import { DashboardService } from './dashboard.service';
export declare class ReportsController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    series(daysRaw?: string): Promise<import("./dashboard.service").ReportSeriesPoint[]>;
    vendorPerformance(): Promise<import("./dashboard.service").VendorPerformanceRow[]>;
    cancellations(): Promise<import("./dashboard.service").CancellationRow[]>;
}
