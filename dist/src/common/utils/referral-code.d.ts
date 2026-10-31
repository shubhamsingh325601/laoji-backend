import type { Db } from '../../config/database.module';
export declare function generateReferralCode(): string;
export declare function normalizeReferralCode(raw?: string | null): string;
export declare function ensureReferralCode(db: Db, userId: string): Promise<string>;
