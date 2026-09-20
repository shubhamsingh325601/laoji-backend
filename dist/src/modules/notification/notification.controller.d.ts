import type { JwtAccessPayload } from '../auth/auth.types';
import { NotificationService } from './notification.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { ContactSupportDto } from './dto/contact-support.dto';
export declare class NotificationController {
    private readonly notifications;
    constructor(notifications: NotificationService);
    getMyNotifications(user: JwtAccessPayload, limit?: string): Promise<{
        id: string;
        channel: "email" | "push" | "sms";
        template: string;
        title: any;
        body: any;
        data: any;
        imageUrl: any;
        status: "failed" | "queued" | "sent";
        createdAt: string;
    }[]>;
    deleteNotification(user: JwtAccessPayload, id: string): Promise<{
        ok: boolean;
    }>;
    clearAllNotifications(user: JwtAccessPayload): Promise<{
        ok: boolean;
    }>;
    registerDeviceToken(user: JwtAccessPayload, dto: RegisterDeviceTokenDto): Promise<{
        id: string;
        userId: string;
        updatedAt: Date;
        fcmToken: string;
        platform: "ios" | "android" | "web";
    }>;
    unregisterDeviceToken(user: JwtAccessPayload, queryToken?: string, body?: {
        fcmToken?: string;
    }): Promise<{
        ok: boolean;
    }>;
    contactSupport(user: JwtAccessPayload, dto: ContactSupportDto): Promise<{
        ok: boolean;
    }>;
}
