import { CustomersService } from './customers.service';
export declare class CustomersController {
    private readonly customersService;
    constructor(customersService: CustomersService);
    getCustomers(): Promise<{
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
