import { randomInt } from 'crypto';
import { eq, isNull, and } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { users } from '../../../drizzle/schema';

// No 0/O/1/I so a code read out loud or typed from a screenshot isn't misread.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeReferralCode(raw?: string | null): string {
  return (raw ?? '').trim().toUpperCase();
}

function isUniqueViolation(err: any): boolean {
  return err?.code === '23505' || err?.cause?.code === '23505';
}

/**
 * Give a user their own shareable code if they don't have one yet. Safe to
 * call repeatedly and concurrently: only a still-null code is ever written,
 * and a collision with someone else's code just retries with a new one.
 */
export async function ensureReferralCode(db: Db, userId: string): Promise<string> {
  const [row] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
  if (row?.code) return row.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [updated] = await db
        .update(users)
        .set({ referralCode: generateReferralCode() })
        .where(and(eq(users.id, userId), isNull(users.referralCode)))
        .returning({ code: users.referralCode });
      if (updated?.code) return updated.code;
      // Lost a race with another request that set it first.
      const [current] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
      if (current?.code) return current.code;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Could not generate a unique referral code');
}
