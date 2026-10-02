import type { Db } from '../../config/database.module';
export declare class HealthController {
    private readonly db;
    constructor(db: Db);
    check(): Promise<{
        status: string;
        db: string;
    }>;
    checkCoupons(): Promise<{
        status: string;
        cols: any;
        coupons: any;
        message?: undefined;
        stack?: undefined;
    } | {
        status: string;
        message: any;
        stack: any;
        cols?: undefined;
        coupons?: undefined;
    }>;
}
