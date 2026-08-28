import { ConfigService } from '@nestjs/config';
import type { EmailMessage, EmailSendResult } from '../notification.types';
export declare class ResendEmailProvider {
    private readonly config;
    private readonly logger;
    private readonly client;
    private readonly fromAddress;
    constructor(config: ConfigService);
    send(to: string, message: EmailMessage): Promise<EmailSendResult>;
}
