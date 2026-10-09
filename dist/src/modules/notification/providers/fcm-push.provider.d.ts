import { ConfigService } from '@nestjs/config';
import type { PushMessage, PushSendOptions, PushSendResult } from '../notification.types';
export declare class FcmPushProvider {
    private readonly config;
    private readonly logger;
    private app;
    private readonly configured;
    constructor(config: ConfigService);
    send(token: string, message: PushMessage, options?: PushSendOptions): Promise<PushSendResult>;
    private sendWithRetry;
}
