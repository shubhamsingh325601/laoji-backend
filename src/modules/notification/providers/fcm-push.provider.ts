import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { PushMessage, PushSendResult } from '../notification.types';

// Real Firebase Admin SDK integration — but with no Firebase project
// configured (FIREBASE_* env vars blank, same as every other unconfigured
// integration in this app — Cloudinary/Resend/Maps), this degrades to a
// dev-mode stub: log the payload and report success, exactly like Phase 1's
// OTP-delivery stub. Swapping in real credentials later needs zero code
// changes here.
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
      this.app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: privateKey!.replace(/\\n/g, '\n') }),
      });
    }
  }

  async send(token: string, message: PushMessage): Promise<PushSendResult> {
    if (!this.configured || !this.app) {
      this.logger.log(`[DEV STUB] push -> token=${token.slice(0, 12)}... title="${message.title}" body="${message.body}"`);
      return { ok: true, stubbed: true };
    }

    try {
      await getMessaging(this.app).send({
        token,
        notification: { title: message.title, body: message.body },
        data: message.data,
      });
      return { ok: true, stubbed: false };
    } catch (e) {
      this.logger.warn(`FCM send failed: ${e instanceof Error ? e.message : e}`);
      return { ok: false, stubbed: false };
    }
  }
}
