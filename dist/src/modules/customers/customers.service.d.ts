import type { Db } from '../../config/database.module';
export declare class CustomersService {
    private readonly db;
    constructor(db: Db);
    getCustomersWithStats(opts?: {
        page?: number;
        limit?: number;
    }): Promise<{
        id: string;
        name: string;
        phone: string | null;
        joinedAt: Date;
        totalOrders: number;
        totalSpend: number;
        locality: string;
        supportNotes: string;
    }[] | {
        customers: {
            id: string;
            name: string;
            phone: string | null;
            joinedAt: Date;
            totalOrders: number;
            totalSpend: number;
            locality: string;
            supportNotes: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
