import type { Db } from '../../config/database.module';
export declare class CustomersService {
    private readonly db;
    constructor(db: Db);
    getCustomersWithStats(): Promise<{
        id: string;
        name: string;
        phone: string | null;
        joinedAt: Date;
        totalOrders: number;
        totalSpend: number;
        locality: string;
        supportNotes: string;
    }[]>;
}
