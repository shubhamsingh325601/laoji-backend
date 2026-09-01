import type { JwtAccessPayload } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { UpdateEmailDto } from './dto/update-email.dto';
export declare class UserController {
    private readonly auth;
    constructor(auth: AuthService);
    me(user: JwtAccessPayload): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
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
    updateEmail(user: JwtAccessPayload, dto: UpdateEmailDto): Promise<{
        id: string;
        phone: string | null;
        email: string | null;
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
}
