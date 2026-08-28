import { NotificationService } from './notification.service';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';
export declare class AdminNotificationController {
    private readonly notifications;
    constructor(notifications: NotificationService);
    listRecent(): Promise<{
        id: string;
        userId: string;
        userLabel: string;
        channel: "email" | "push" | "sms";
        template: string;
        payload: unknown;
        status: "failed" | "queued" | "sent";
        sentAt: Date | null;
        createdAt: Date;
    }[]>;
    sendNotification(dto: SendAdminNotificationDto): Promise<{
        sentCount: number;
        target: "customer" | "vendor" | "delivery_partner" | "restaurant" | "user" | "all";
        channels: ("email" | "push" | "sms")[];
        message: string;
    }>;
}
