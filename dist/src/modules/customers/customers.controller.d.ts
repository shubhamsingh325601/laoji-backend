import { CustomersService } from './customers.service';
export declare class CustomersController {
    private readonly customersService;
    constructor(customersService: CustomersService);
    getCustomers(page?: string, limit?: string): Promise<{
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
