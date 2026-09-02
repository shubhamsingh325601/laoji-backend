import type { Db } from '../../config/database.module';
import { JobQueueService } from '../allocation/job-queue.service';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import type { EmailMessage, PushMessage } from './notification.types';
type Platform = 'ios' | 'android' | 'web';
export declare class NotificationService {
    private readonly db;
    private readonly jobQueue;
    private readonly push;
    private readonly email;
    private readonly logger;
    constructor(db: Db, jobQueue: JobQueueService, push: FcmPushProvider, email: ResendEmailProvider);
    registerDeviceToken(userId: string, fcmToken: string, platform: Platform): Promise<{
        id: string;
        userId: string;
        updatedAt: Date;
        fcmToken: string;
        platform: "ios" | "android" | "web";
    }>;
    notifyPush(userId: string, template: string, message: PushMessage): void;
    notifyEmail(userId: string, template: string, message: EmailMessage): void;
    notifySms(userId: string, template: string, message: {
        text: string;
        phone?: string;
    }): void;
    notifyAllAdminsEmail(template: string, message: EmailMessage): Promise<void>;
    private dispatchPush;
    private dispatchEmail;
    private dispatchSms;
    private log;
    sendWelcomeCustomerEmail(user: {
        id: string;
        name?: string;
        email?: string;
        phone?: string;
    }): Promise<void>;
    sendWelcomeVendorEmail(vendor: {
        id: string;
        businessName: string;
        ownerName: string;
        email?: string;
        phone?: string;
        type?: string;
        tempPassword?: string;
        apkDownloadUrl?: string;
    }): Promise<void>;
    sendWelcomePartnerEmail(partner: {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        vehicleType?: string;
    }): Promise<void>;
    sendSupportMessage(userId: string, role: string, subject: string, message: string): Promise<void>;
    sendAdminNotification(dto: {
        target: 'all' | 'customer' | 'vendor' | 'restaurant' | 'delivery_partner' | 'user';
        channel?: 'push' | 'email' | 'sms' | 'all';
        channels?: ('push' | 'email' | 'sms')[];
        userId?: string;
        phone?: string;
        email?: string;
        title: string;
        message: string;
    }): Promise<{
        sentCount: number;
        target: "customer" | "vendor" | "delivery_partner" | "restaurant" | "all" | "user";
        channels: ("email" | "push" | "sms")[];
        message: string;
    }>;
    listRecentForAdmin(limit?: number): Promise<{
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
}
export {};
