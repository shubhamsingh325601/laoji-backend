import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { EmailMessage, EmailSendResult } from '../notification.types';

// Same dev-mode-stub-when-unconfigured shape as FcmPushProvider — logs the
// rendered subject/html instead of sending when RESEND_API_KEY is blank.
@Injectable()
export class ResendEmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly client: Resend | null;
  private readonly fromAddress = 'Laoji <notifications@laoji.app>';

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async send(to: string, message: EmailMessage): Promise<EmailSendResult> {
    if (!this.client) {
      this.logger.log(`[DEV STUB] email -> to=${to} subject="${message.subject}"\n${message.html}`);
      return { ok: true, stubbed: true };
    }

    try {
      const { error } = await this.client.emails.send({
        from: this.fromAddress,
        to,
        subject: message.subject,
        html: message.html,
      });
      if (error) {
        this.logger.warn(`Resend send failed: ${error.message}`);
        return { ok: false, stubbed: false };
      }
      return { ok: true, stubbed: false };
    } catch (e) {
      this.logger.warn(`Resend send failed: ${e instanceof Error ? e.message : e}`);
      return { ok: false, stubbed: false };
    }
  }
}
