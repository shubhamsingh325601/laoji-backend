import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
export declare class AppThrottlerGuard extends ThrottlerGuard {
    protected handleRequest(requestProps: ThrottlerRequest): Promise<boolean>;
}
