import { UserService } from './user.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto';
export declare class AdminUserController {
    private readonly users;
    constructor(users: UserService);
    list(role?: string, search?: string): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        name: string;
        supportNotes: string;
        address: string;
        createdAt: Date;
        totalOrders: number;
        totalSpend: number;
        walletBalance: number;
    }[]>;
    getOne(id: string): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        name: string;
        supportNotes: string;
        addresses: any[];
        orderCount: number;
        totalSpend: number;
        walletBalance: number;
        recentOrders: any[];
        createdAt: Date;
    }>;
    create(dto: CreateAdminUserDto): Promise<{
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        passwordHash: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        city: string | null;
        timezone: string | null;
        notifyStuckOrders: boolean;
        notifyKyc: boolean;
        supportNotes: string | null;
        mustChangePassword: boolean;
        createdAt: Date;
    }>;
    update(id: string, dto: UpdateAdminUserDto): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        passwordHash: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        name: string | null;
        city: string | null;
        timezone: string | null;
        notifyStuckOrders: boolean;
        notifyKyc: boolean;
        supportNotes: string | null;
        mustChangePassword: boolean;
        createdAt: Date;
    }>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
