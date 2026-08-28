"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../config/database.module");
const schema_1 = require("../../../drizzle/schema");
const job_queue_service_1 = require("../allocation/job-queue.service");
const fcm_push_provider_1 = require("./providers/fcm-push.provider");
const resend_email_provider_1 = require("./providers/resend-email.provider");
const support_message_1 = require("./templates/email/support-message");
const welcome_customer_1 = require("./templates/email/welcome-customer");
const welcome_vendor_1 = require("./templates/email/welcome-vendor");
const welcome_partner_1 = require("./templates/email/welcome-partner");
const admin_broadcast_1 = require("./templates/email/admin-broadcast");
let NotificationService = NotificationService_1 = class NotificationService {
    db;
    jobQueue;
    push;
    email;
    logger = new common_1.Logger(NotificationService_1.name);
    constructor(db, jobQueue, push, email) {
        this.db = db;
        this.jobQueue = jobQueue;
        this.push = push;
        this.email = email;
    }
    async registerDeviceToken(userId, fcmToken, platform) {
        const [existing] = await this.db
            .select()
            .from(schema_1.deviceTokens)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deviceTokens.userId, userId), (0, drizzle_orm_1.eq)(schema_1.deviceTokens.platform, platform)))
            .limit(1);
        if (existing) {
            const [updated] = await this.db
                .update(schema_1.deviceTokens)
                .set({ fcmToken, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.deviceTokens.id, existing.id))
                .returning();
            return updated;
        }
        const [created] = await this.db.insert(schema_1.deviceTokens).values({ userId, fcmToken, platform }).returning();
        return created;
    }
    notifyPush(userId, template, message) {
        this.jobQueue.schedule(`notify-push:${(0, crypto_1.randomUUID)()}`, 0, () => this.dispatchPush(userId, template, message));
    }
    notifyEmail(userId, template, message) {
        this.jobQueue.schedule(`notify-email:${(0, crypto_1.randomUUID)()}`, 0, () => this.dispatchEmail(userId, template, message));
    }
    notifySms(userId, template, message) {
        this.jobQueue.schedule(`notify-sms:${(0, crypto_1.randomUUID)()}`, 0, () => this.dispatchSms(userId, template, message));
    }
    async notifyAllAdminsEmail(template, message) {
        const admins = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, 'admin'));
        for (const admin of admins) {
            this.notifyEmail(admin.id, template, message);
        }
    }
    async dispatchPush(userId, template, message) {
        const tokens = await this.db.select().from(schema_1.deviceTokens).where((0, drizzle_orm_1.eq)(schema_1.deviceTokens.userId, userId));
        if (!tokens.length) {
            await this.log(userId, 'push', template, message, 'failed');
            return;
        }
        const results = await Promise.all(tokens.map((t) => this.push.send(t.fcmToken, message)));
        await this.log(userId, 'push', template, message, results.some((r) => r.ok) ? 'sent' : 'failed');
    }
    async dispatchEmail(userId, template, message) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user?.email) {
            this.logger.debug(`Skipping email "${template}" for ${userId} — no email on file`);
            await this.log(userId, 'email', template, message, 'failed');
            return;
        }
        const result = await this.email.send(user.email, message);
        await this.log(userId, 'email', template, message, result.ok ? 'sent' : 'failed');
    }
    async dispatchSms(userId, template, message) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        const destinationPhone = message.phone || user?.phone;
        if (!destinationPhone) {
            this.logger.debug(`Skipping SMS "${template}" for ${userId} — no phone number`);
            await this.log(userId, 'sms', template, message, 'failed');
            return;
        }
        this.logger.log(`[SMS-OUT] To: +91 ${destinationPhone} | Message: ${message.text}`);
        await this.log(userId, 'sms', template, message, 'sent');
    }
    async log(userId, channel, template, payload, status) {
        try {
            await this.db.insert(schema_1.notificationLog).values({
                userId,
                channel,
                template,
                payloadJson: payload,
                status,
                sentAt: status === 'sent' ? new Date() : null,
            });
        }
        catch (err) {
            this.logger.warn(`Failed to write notification_log for user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async sendWelcomeCustomerEmail(user) {
        if (!user.email)
            return;
        this.notifyEmail(user.id, 'welcome_customer', (0, welcome_customer_1.welcomeCustomerEmail)(user));
    }
    async sendWelcomeVendorEmail(vendor) {
        if (!vendor.email)
            return;
        this.notifyEmail(vendor.id, 'welcome_vendor', (0, welcome_vendor_1.welcomeVendorEmail)(vendor));
    }
    async sendWelcomePartnerEmail(partner) {
        if (!partner.email)
            return;
        this.notifyEmail(partner.id, 'welcome_partner', (0, welcome_partner_1.welcomePartnerEmail)(partner));
    }
    async sendSupportMessage(userId, role, subject, message) {
        const [user] = await this.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        await this.notifyAllAdminsEmail('support_message', (0, support_message_1.supportMessageAdminEmail)({
            fromRole: role,
            fromPhone: user?.phone ?? null,
            fromEmail: user?.email ?? null,
            subject,
            message,
        }));
    }
    async sendAdminNotification(dto) {
        let targetUsers = [];
        if (dto.target === 'user') {
            if (dto.userId) {
                const [u] = await this.db.select({ id: schema_1.users.id, email: schema_1.users.email, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, dto.userId)).limit(1);
                if (u)
                    targetUsers = [u];
            }
            else if (dto.phone) {
                targetUsers = await this.db.select({ id: schema_1.users.id, email: schema_1.users.email, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.phone, dto.phone));
            }
            else if (dto.email) {
                targetUsers = await this.db.select({ id: schema_1.users.id, email: schema_1.users.email, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, dto.email));
            }
        }
        else if (dto.target === 'all') {
            targetUsers = await this.db.select({ id: schema_1.users.id, email: schema_1.users.email, phone: schema_1.users.phone }).from(schema_1.users);
        }
        else if (dto.target === 'restaurant') {
            targetUsers = await this.db.select({ id: schema_1.users.id, email: schema_1.users.email, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, 'vendor'));
        }
        else {
            targetUsers = await this.db.select({ id: schema_1.users.id, email: schema_1.users.email, phone: schema_1.users.phone }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.role, dto.target));
        }
        const activeChannels = new Set();
        if (dto.channels && dto.channels.length > 0) {
            dto.channels.forEach((c) => activeChannels.add(c));
        }
        else if (dto.channel === 'all' || !dto.channel) {
            activeChannels.add('push');
            activeChannels.add('email');
            activeChannels.add('sms');
        }
        else {
            activeChannels.add(dto.channel);
        }
        for (const u of targetUsers) {
            if (activeChannels.has('push')) {
                this.notifyPush(u.id, 'admin_broadcast', {
                    title: dto.title,
                    body: dto.message,
                    data: { type: 'admin_broadcast', target: dto.target },
                });
            }
            if (activeChannels.has('email') && u.email) {
                this.notifyEmail(u.id, 'admin_broadcast', (0, admin_broadcast_1.adminBroadcastEmail)({
                    title: dto.title,
                    message: dto.message,
                }));
            }
            if (activeChannels.has('sms') && u.phone) {
                this.notifySms(u.id, 'admin_broadcast', {
                    text: `${dto.title}: ${dto.message.slice(0, 140)} (Laoji)`,
                    phone: u.phone,
                });
            }
        }
        return {
            sentCount: targetUsers.length,
            target: dto.target,
            channels: Array.from(activeChannels),
            message: `Notification queued for ${targetUsers.length} recipient(s) across [${Array.from(activeChannels).join(', ')}].`,
        };
    }
    async listRecentForAdmin(limit = 100) {
        const rows = await this.db.select().from(schema_1.notificationLog).orderBy((0, drizzle_orm_1.desc)(schema_1.notificationLog.createdAt)).limit(limit);
        if (!rows.length)
            return [];
        const allUsers = await this.db.select().from(schema_1.users);
        const byId = new Map(allUsers.map((u) => [u.id, u]));
        return rows.map((r) => {
            const u = byId.get(r.userId);
            return {
                id: r.id,
                userId: r.userId,
                userLabel: u?.phone ? `+91 ${u.phone}` : u?.email ?? 'Unknown user',
                channel: r.channel,
                template: r.template,
                payload: r.payloadJson,
                status: r.status,
                sentAt: r.sentAt,
                createdAt: r.createdAt,
            };
        });
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE)),
    __metadata("design:paramtypes", [Object, job_queue_service_1.JobQueueService,
        fcm_push_provider_1.FcmPushProvider,
        resend_email_provider_1.ResendEmailProvider])
], NotificationService);
//# sourceMappingURL=notification.service.js.map