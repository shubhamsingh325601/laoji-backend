export declare class JobQueueService {
    private readonly logger;
    private readonly timers;
    schedule(key: string, delayMs: number, fn: () => void | Promise<void>): void;
    cancel(key: string): void;
}
