import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import type { PushMessage, PushSendResult } from '../notification.types';

// Real Firebase Admin SDK integration — with graceful fallback to dev-mode stub
// if FIREBASE_* env credentials are not yet configured.
@Injectable()
export class FcmPushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private app: App | null = null;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    this.configured = !!(projectId && clientEmail && privateKey);

    if (this.configured) {
      try {
        this.app = initializeApp({
          credential: cert({ projectId, clientEmail, privateKey: privateKey!.replace(/\\n/g, '\n') }),
        });
        this.logger.log(`Initialized Firebase Admin SDK for project "${projectId}".`);
      } catch (err: any) {
        this.logger.error(`Failed to initialize Firebase Admin SDK: ${err?.message || err}`);
      }
    } else {
      this.logger.warn('FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set — FcmPushProvider running in DEV STUB mode.');
    }
  }

  async send(token: string, message: PushMessage): Promise<PushSendResult> {
    if (!this.configured || !this.app) {
      this.logger.log(`[DEV STUB] push -> token=${token.slice(0, 12)}... title="${message.title}" body="${message.body}"`);
      return { ok: true, stubbed: true };
    }

    try {
      const payload: Message = {
        token,
        notification: {
          title: message.title,
          body: message.body,
          ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
        },
        android: {
          notification: {
            sound: 'default',
            priority: 'high',
            channelId: 'default',
            icon: 'notification_icon',
            color: '#0A1938',
            ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              'mutable-content': 1,
            },
          },
          fcmOptions: {
            ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
          },
        },
        data: message.data || {},
      };

      await getMessaging(this.app).send(payload);
      return { ok: true, stubbed: false };
    } catch (e: any) {
      const code = e?.code || e?.errorInfo?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`Stale or invalid FCM token (${code}): ${token.slice(0, 12)}...`);
      } else {
        this.logger.warn(`FCM send failed: ${e instanceof Error ? e.message : e}`);
      }
      return { ok: false, stubbed: false, error: e?.message };
    }
  }
}
