import type { JwtAccessPayload } from '../auth/auth.types';
import { NotificationService } from './notification.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { ContactSupportDto } from './dto/contact-support.dto';
export declare class NotificationController {
    private readonly notifications;
    constructor(notifications: NotificationService);
    registerDeviceToken(user: JwtAccessPayload, dto: RegisterDeviceTokenDto): Promise<{
        id: string;
        userId: string;
        updatedAt: Date;
        fcmToken: string;
        platform: "ios" | "android" | "web";
    }>;
    contactSupport(user: JwtAccessPayload, dto: ContactSupportDto): Promise<{
        ok: boolean;
    }>;
}
