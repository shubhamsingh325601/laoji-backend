"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const cleanString = (val) => {
    if (typeof val === 'string') {
        return val.replace(/^["']|["']$/g, '').trim();
    }
    return val;
};
exports.envSchema = zod_1.z.object({
    PORT: zod_1.z.preprocess(cleanString, zod_1.z.coerce.number().default(3000)),
    NODE_ENV: zod_1.z.preprocess(cleanString, zod_1.z.enum(['development', 'test', 'production']).default('development')),
    OTP_TEST_MODE: zod_1.z
        .preprocess(cleanString, zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false']), zod_1.z.string()]))
        .optional()
        .transform((v) => v === true || v === 'true'),
    CORS_ORIGIN: zod_1.z.preprocess(cleanString, zod_1.z.string().default('http://localhost:8080')),
    DATABASE_URL: zod_1.z.preprocess(cleanString, zod_1.z.string().min(1, 'DATABASE_URL is required')),
    JWT_ACCESS_SECRET: zod_1.z.preprocess(cleanString, zod_1.z.string().min(1, 'JWT_ACCESS_SECRET is required')),
    JWT_REFRESH_SECRET: zod_1.z.preprocess(cleanString, zod_1.z.string().min(1, 'JWT_REFRESH_SECRET is required')),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.preprocess(cleanString, zod_1.z.string().default('15m')),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.preprocess(cleanString, zod_1.z.string().default('30d')),
    CLOUDINARY_CLOUD_NAME: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    CLOUDINARY_API_KEY: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    CLOUDINARY_API_SECRET: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    FIREBASE_PROJECT_ID: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    FIREBASE_CLIENT_EMAIL: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    FIREBASE_PRIVATE_KEY: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    RESEND_API_KEY: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
    RESEND_FROM_EMAIL: zod_1.z.preprocess(cleanString, zod_1.z.string().default('Laoji <no-reply@laojionline.com>')),
    PAYMENT_PROVIDER: zod_1.z.preprocess(cleanString, zod_1.z.enum(['upi_deeplink', 'razorpay']).default('upi_deeplink')),
    UPI_VPA: zod_1.z.preprocess(cleanString, zod_1.z.string().default('laoji@upi')),
    UPI_PAYEE_NAME: zod_1.z.preprocess(cleanString, zod_1.z.string().default('Laoji')),
    GOOGLE_MAPS_API_KEY: zod_1.z.preprocess(cleanString, zod_1.z.string().default('')),
});
function validateEnv(config) {
    const parsed = exports.envSchema.safeParse(config);
    if (!parsed.success) {
        console.error('Environment validation failed with errors:', parsed.error.format());
        throw new Error(`Invalid environment configuration:\n${parsed.error.issues
            .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n')}`);
    }
    return parsed.data;
}
//# sourceMappingURL=env.schema.js.map