import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import type { PushMessage, PushSendOptions, PushSendResult } from '../notification.types';
import { isValidNotificationSound, soundChannelId } from '../notification-sound';

// A new-order or delivery-offer push is useless once the 120s allocation window
// has passed, so FCM may drop it after 2 minutes instead of queueing it.
const PUSH_TTL_MS = 120_000;

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const TRANSIENT_CODES = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/unavailable',
  'messaging/quota-exceeded',
]);

// FCM rejects the whole message if any data value is not a string. Templates
// are typed as strings, but admin broadcasts and future callers can slip a
// number or boolean through, which would silently drop the push.
function stringifyData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

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

  async send(token: string, message: PushMessage, options: PushSendOptions = {}): Promise<PushSendResult> {
    if (!this.configured || !this.app) {
      this.logger.log(`[DEV STUB] push -> token=${token.slice(0, 12)}... title="${message.title}" body="${message.body}"`);
      return { ok: true, stubbed: true };
    }

    // A custom sound lives in its own channel on the device. Fall back to the
    // shared channel if the id is missing or malformed.
    const customSound = isValidNotificationSound(options.androidSound) ? options.androidSound : null;

    try {
      const payload: Message = {
        token,
        notification: {
          title: message.title,
          body: message.body,
          ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
        },
        android: {
          // High priority wakes a dozing device right away. Without it Android
          // can hold a "normal" push for minutes, so a new order or delivery
          // offer lands after it has already timed out. The TTL stops a stale
          // offer being delivered long after the allocation window closed.
          priority: 'high',
          ttl: PUSH_TTL_MS,
          notification: {
            // Android 8+ plays the channel's sound; `sound` covers older versions.
            sound: customSound ?? 'default',
            priority: 'high',
            channelId: customSound ? soundChannelId(customSound) : 'default',
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
        webpush: {
          notification: {
            title: message.title,
            body: message.body,
            icon: '/app-logo.png',
            badge: '/favicon.ico',
            requireInteraction: true,
            ...(message.imageUrl ? { image: message.imageUrl } : {}),
          },
          fcmOptions: {
            link: (message.data?.url as string) || (message.data?.link as string) || '/orders',
          },
        },
        data: stringifyData(message.data),
      };

      await this.sendWithRetry(this.app, payload);
      return { ok: true, stubbed: false };
    } catch (e: any) {
      const code = e?.code || e?.errorInfo?.code;
      if (INVALID_TOKEN_CODES.has(code)) {
        this.logger.warn(`Stale or invalid FCM token (${code}): ${token.slice(0, 12)}...`);
        return { ok: false, stubbed: false, error: e?.message, invalidToken: true };
      }
      this.logger.warn(`FCM send failed: ${e instanceof Error ? e.message : e}`);
      return { ok: false, stubbed: false, error: e?.message };
    }
  }

  // One quick retry for transient FCM/network errors. A dead token or a bad
  // payload fails the same way twice, so those are thrown straight away.
  private async sendWithRetry(app: App, payload: Message) {
    try {
      await getMessaging(app).send(payload);
    } catch (e: any) {
      const code = e?.code || e?.errorInfo?.code;
      if (!TRANSIENT_CODES.has(code)) throw e;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await getMessaging(app).send(payload);
    }
  }
}
