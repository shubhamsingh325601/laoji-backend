"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = generateReferralCode;
exports.normalizeReferralCode = normalizeReferralCode;
exports.ensureReferralCode = ensureReferralCode;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../../../drizzle/schema");
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
function generateReferralCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++)
        code += ALPHABET[(0, crypto_1.randomInt)(ALPHABET.length)];
    return code;
}
function normalizeReferralCode(raw) {
    return (raw ?? '').trim().toUpperCase();
}
function isUniqueViolation(err) {
    return err?.code === '23505' || err?.cause?.code === '23505';
}
async function ensureReferralCode(db, userId) {
    const [row] = await db.select({ code: schema_1.users.referralCode }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
    if (row?.code)
        return row.code;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const [updated] = await db
                .update(schema_1.users)
                .set({ referralCode: generateReferralCode() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.id, userId), (0, drizzle_orm_1.isNull)(schema_1.users.referralCode)))
                .returning({ code: schema_1.users.referralCode });
            if (updated?.code)
                return updated.code;
            const [current] = await db.select({ code: schema_1.users.referralCode }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
            if (current?.code)
                return current.code;
        }
        catch (err) {
            if (!isUniqueViolation(err))
                throw err;
        }
    }
    throw new Error('Could not generate a unique referral code');
}
//# sourceMappingURL=referral-code.js.map