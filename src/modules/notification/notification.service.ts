import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { deviceTokens, notificationLog, users } from '../../../drizzle/schema';
import { JobQueueService } from '../allocation/job-queue.service';
import { FcmPushProvider } from './providers/fcm-push.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import type { EmailMessage, PushMessage } from './notification.types';
import { supportMessageAdminEmail } from './templates/email/support-message';

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

  // Enqueues off the request thread (TRD Section 6 — order-state
  // transactions must not block on a 3rd-party push API) using the exact
  // same JobQueueService as Phase 4/5's allocation/reassignment jobs, per
  // the "reuse the pattern" instruction. delayMs=0 is enough to get off
  // the calling transaction's call stack — there's no retry/backoff here
  // (JobQueueService doesn't have one, and this is MVP scope); a failed
  // send is just logged with status='failed', not retried.
  notifyPush(userId: string, template: string, message: PushMessage): void {
    this.jobQueue.schedule(`notify-push:${randomUUID()}`, 0, () => this.dispatchPush(userId, template, message));
  }

  notifyEmail(userId: string, template: string, message: EmailMessage): void {
    this.jobQueue.schedule(`notify-email:${randomUUID()}`, 0, () => this.dispatchEmail(userId, template, message));
  }

  // Convenience for admin-ops-alert templates that target every admin
  // rather than one specific user.
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

  private async log(
    userId: string,
    channel: 'push' | 'email',
    template: string,
    payload: PushMessage | EmailMessage,
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

  // Post-Phase-11 MVP-completion pass (Customer Support). Reuses the exact
  // Resend path Phase 7 built and the notifyAllAdminsEmail broadcast
  // AllocationService's admin-alert already relies on — no second email
  // integration, no ticket table.
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

  // ---------- Admin visibility ----------

  async listRecentForAdmin(limit = 100) {
    const rows = await this.db.select().from(notificationLog).orderBy(desc(notificationLog.createdAt)).limit(limit);
    if (!rows.length) return [];

    // Small admin-only listing (capped at `limit`) — one bulk user fetch
    // is simpler than an inArray-filtered query for this scale.
    const allUsers = await this.db.select().from(users);
    const byId = new Map(allUsers.map((u) => [u.id, u]));

    return rows.map((r) => {
      const u = byId.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        userLabel: u?.phone ?? u?.email ?? 'Unknown user',
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
