import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { deviceTokens, notificationLog, users } from '../../../drizzle/schema';
import { JobQueueService } from '../allocation/job-queue.service';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import type { EmailMessage, PushMessage } from './notification.types';
import { supportMessageAdminEmail } from './templates/email/support-message';
import { welcomeCustomerEmail } from './templates/email/welcome-customer';
import { welcomeVendorEmail } from './templates/email/welcome-vendor';
import { welcomePartnerEmail } from './templates/email/welcome-partner';
import { adminBroadcastEmail } from './templates/email/admin-broadcast';

type Platform = 'ios' | 'android' | 'web';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly jobQueue: JobQueueService,
    private readonly push: FcmPushProvider,
    private readonly email: ResendEmailProvider,
  ) {}

  async registerDeviceToken(userId: string, fcmToken: string, platform: Platform) {
    const [existing] = await this.db
      .select()
      .from(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.platform, platform)))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(deviceTokens)
        .set({ fcmToken, updatedAt: new Date() })
        .where(eq(deviceTokens.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db.insert(deviceTokens).values({ userId, fcmToken, platform }).returning();
    return created;
  }

  notifyPush(userId: string, template: string, message: PushMessage): void {
    this.jobQueue.schedule(`notify-push:${randomUUID()}`, 0, () => this.dispatchPush(userId, template, message));
  }

  notifyEmail(userId: string, template: string, message: EmailMessage): void {
    this.jobQueue.schedule(`notify-email:${randomUUID()}`, 0, () => this.dispatchEmail(userId, template, message));
  }

  notifySms(userId: string, template: string, message: { text: string; phone?: string }): void {
    this.jobQueue.schedule(`notify-sms:${randomUUID()}`, 0, () => this.dispatchSms(userId, template, message));
  }

  async notifyAllAdminsEmail(template: string, message: EmailMessage) {
    const admins = await this.db.select().from(users).where(eq(users.role, 'admin'));
    for (const admin of admins) {
      this.notifyEmail(admin.id, template, message);
    }
  }

  private async dispatchPush(userId: string, template: string, message: PushMessage) {
    const tokens = await this.db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId));
    if (!tokens.length) {
      await this.log(userId, 'push', template, message, 'failed');
      return;
    }
    const results = await Promise.all(tokens.map((t) => this.push.send(t.fcmToken, message)));
    await this.log(userId, 'push', template, message, results.some((r) => r.ok) ? 'sent' : 'failed');
  }

  private async dispatchEmail(userId: string, template: string, message: EmailMessage) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.email) {
      this.logger.debug(`Skipping email "${template}" for ${userId} — no email on file`);
      await this.log(userId, 'email', template, message, 'failed');
      return;
    }
    const result = await this.email.send(user.email, message);
    await this.log(userId, 'email', template, message, result.ok ? 'sent' : 'failed');
  }

  private async dispatchSms(userId: string, template: string, message: { text: string; phone?: string }) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const destinationPhone = message.phone || user?.phone;
    if (!destinationPhone) {
      this.logger.debug(`Skipping SMS "${template}" for ${userId} — no phone number`);
      await this.log(userId, 'sms', template, message, 'failed');
      return;
    }
    // SMS dispatch log (ready for integration with SMS gateway like Fast2SMS / Twilio)
    this.logger.log(`[SMS-OUT] To: +91 ${destinationPhone} | Message: ${message.text}`);
    await this.log(userId, 'sms', template, message, 'sent');
  }

  private async log(
    userId: string,
    channel: 'push' | 'email' | 'sms',
    template: string,
    payload: any,
    status: 'sent' | 'failed',
  ) {
    await this.db.insert(notificationLog).values({
      userId,
      channel,
      template,
      payloadJson: payload,
      status,
      sentAt: status === 'sent' ? new Date() : null,
    });
  }

  // Welcome emails with corporate signature for invited users
  async sendWelcomeCustomerEmail(user: { id: string; name?: string; email?: string; phone?: string }) {
    if (!user.email) return;
    this.notifyEmail(user.id, 'welcome_customer', welcomeCustomerEmail(user));
  }

  async sendWelcomeVendorEmail(vendor: {
    id: string;
    businessName: string;
    ownerName: string;
    email?: string;
    phone?: string;
    type?: string;
  }) {
    if (!vendor.email) return;
    this.notifyEmail(vendor.id, 'welcome_vendor', welcomeVendorEmail(vendor));
  }

  async sendWelcomePartnerEmail(partner: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    vehicleType?: string;
  }) {
    if (!partner.email) return;
    this.notifyEmail(partner.id, 'welcome_partner', welcomePartnerEmail(partner));
  }

  async sendSupportMessage(userId: string, role: string, subject: string, message: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    await this.notifyAllAdminsEmail(
      'support_message',
      supportMessageAdminEmail({
        fromRole: role,
        fromPhone: user?.phone ?? null,
        fromEmail: user?.email ?? null,
        subject,
        message,
      }),
    );
  }

  async sendAdminNotification(dto: {
    target: 'all' | 'customer' | 'vendor' | 'restaurant' | 'delivery_partner' | 'user';
    channel?: 'push' | 'email' | 'sms' | 'all';
    channels?: ('push' | 'email' | 'sms')[];
    userId?: string;
    phone?: string;
    email?: string;
    title: string;
    message: string;
  }) {
    let targetUsers: { id: string; email?: string | null; phone?: string | null }[] = [];

    if (dto.target === 'user') {
      if (dto.userId) {
        const [u] = await this.db.select({ id: users.id, email: users.email, phone: users.phone }).from(users).where(eq(users.id, dto.userId)).limit(1);
        if (u) targetUsers = [u];
      } else if (dto.phone) {
        targetUsers = await this.db.select({ id: users.id, email: users.email, phone: users.phone }).from(users).where(eq(users.phone, dto.phone));
      } else if (dto.email) {
        targetUsers = await this.db.select({ id: users.id, email: users.email, phone: users.phone }).from(users).where(eq(users.email, dto.email));
      }
    } else if (dto.target === 'all') {
      targetUsers = await this.db.select({ id: users.id, email: users.email, phone: users.phone }).from(users);
    } else if (dto.target === 'restaurant') {
      targetUsers = await this.db.select({ id: users.id, email: users.email, phone: users.phone }).from(users).where(eq(users.role, 'vendor'));
    } else {
      targetUsers = await this.db.select({ id: users.id, email: users.email, phone: users.phone }).from(users).where(eq(users.role, dto.target));
    }

    // Determine channels to dispatch
    const activeChannels = new Set<'push' | 'email' | 'sms'>();
    if (dto.channels && dto.channels.length > 0) {
      dto.channels.forEach((c) => activeChannels.add(c));
    } else if (dto.channel === 'all' || !dto.channel) {
      activeChannels.add('push');
      activeChannels.add('email');
      activeChannels.add('sms');
    } else {
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
        this.notifyEmail(u.id, 'admin_broadcast', adminBroadcastEmail({
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

  // ---------- Admin visibility ----------

  async listRecentForAdmin(limit = 100) {
    const rows = await this.db.select().from(notificationLog).orderBy(desc(notificationLog.createdAt)).limit(limit);
    if (!rows.length) return [];

    const allUsers = await this.db.select().from(users);
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
}
