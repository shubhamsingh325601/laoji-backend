import type { Db } from '../../config/database.module';
export declare class HealthController {
    private readonly db;
    constructor(db: Db);
    check(): Promise<{
        status: string;
        db: string;
    }>;
}
