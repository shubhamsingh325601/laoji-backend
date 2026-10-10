import type { Db } from '../../config/database.module';
import { NotificationService } from '../notification/notification.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto';
export declare class UserService {
    private readonly db;
    private readonly notifications;
    constructor(db: Db, notifications: NotificationService);
    listUsers(role?: string, search?: string): Promise<{
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
    getUser(id: string): Promise<{
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
    createUser(dto: CreateAdminUserDto): Promise<{
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
    updateUser(id: string, dto: UpdateAdminUserDto): Promise<{
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
    deleteUser(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
