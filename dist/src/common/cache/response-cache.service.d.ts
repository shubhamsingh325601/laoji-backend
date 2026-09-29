export declare const RESPONSE_CACHE_TTL_MS: number;
export declare class ResponseCacheService {
    private readonly entries;
    get(key: string): {
        hit: true;
        value: unknown;
    } | {
        hit: false;
    };
    set(key: string, value: unknown, ttlMs?: number): void;
    clear(): void;
}
