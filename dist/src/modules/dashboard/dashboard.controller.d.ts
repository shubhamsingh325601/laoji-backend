import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    stats(): Promise<import("./dashboard.service").DashboardStats>;
    attention(): Promise<import("./dashboard.service").AttentionItem[]>;
}
