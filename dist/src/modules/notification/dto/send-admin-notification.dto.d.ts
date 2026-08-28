export declare const NOTIFICATION_TARGETS: readonly ["all", "customer", "vendor", "restaurant", "delivery_partner", "user"];
export type NotificationTarget = (typeof NOTIFICATION_TARGETS)[number];
export declare const NOTIFICATION_CHANNELS: readonly ["push", "email", "sms", "all"];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export declare class SendAdminNotificationDto {
    target: NotificationTarget;
    channel?: NotificationChannel;
    channels?: ('push' | 'email' | 'sms')[];
    userId?: string;
    phone?: string;
    email?: string;
    title: string;
    message: string;
}
