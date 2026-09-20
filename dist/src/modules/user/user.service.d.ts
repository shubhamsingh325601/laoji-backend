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
    }[]>;
    getUser(id: string): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
        role: "customer" | "vendor" | "delivery_partner" | "admin";
        status: "active" | "suspended";
        name: string;
        supportNotes: string;
        addresses: {
            id: string;
            userId: string;
            label: string | null;
            lat: number;
            lng: number;
            formattedAddress: string;
            isDefault: boolean;
        }[];
        orderCount: number;
        recentOrders: ({
            id: string;
            customerId: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            subtotal: number;
            deliveryFee: number;
            platformCommission: number;
            commissionPct: number;
            total: number;
            paymentStatus: string;
            instructions: string | null;
            vendorId: string | null;
            deliveryAddressId: string;
            deliveryPartnerId: string | null;
            deliveryOtp: string | null;
            createdAt: Date;
        } | {
            id: string;
            customerId: string;
            status: "placed" | "vendor_accepted" | "preparing" | "ready" | "handed_over" | "delivery_assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
            subtotal: number;
            deliveryFee: number;
            platformCommission: number;
            commissionPct: number;
            total: number;
            paymentStatus: string;
            instructions: string | null;
            restaurantId: string;
            deliveryAddressId: string;
            deliveryPartnerId: string | null;
            deliveryOtp: string | null;
            createdAt: Date;
        })[];
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
