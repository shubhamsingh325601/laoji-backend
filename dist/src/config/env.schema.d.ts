import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    PORT: z.ZodPreprocess<z.ZodDefault<z.ZodCoercedNumber<unknown>>, unknown>;
    NODE_ENV: z.ZodPreprocess<z.ZodDefault<z.ZodEnum<{
        development: "development";
        test: "test";
        production: "production";
    }>>, unknown>;
    OTP_TEST_MODE: z.ZodPipe<z.ZodOptional<z.ZodPreprocess<z.ZodUnion<readonly [z.ZodBoolean, z.ZodEnum<{
        true: "true";
        false: "false";
    }>, z.ZodString]>, unknown>>, z.ZodTransform<boolean, string | boolean | undefined>>;
    CORS_ORIGIN: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    DATABASE_URL: z.ZodPreprocess<z.ZodString, unknown>;
    JWT_ACCESS_SECRET: z.ZodPreprocess<z.ZodString, unknown>;
    JWT_REFRESH_SECRET: z.ZodPreprocess<z.ZodString, unknown>;
    JWT_ACCESS_EXPIRES_IN: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    JWT_REFRESH_EXPIRES_IN: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    CLOUDINARY_CLOUD_NAME: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    CLOUDINARY_API_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    CLOUDINARY_API_SECRET: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    FIREBASE_PROJECT_ID: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    FIREBASE_CLIENT_EMAIL: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    FIREBASE_PRIVATE_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    RESEND_API_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    RESEND_FROM_EMAIL: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    PAYMENT_PROVIDER: z.ZodPreprocess<z.ZodDefault<z.ZodEnum<{
        upi_deeplink: "upi_deeplink";
        razorpay: "razorpay";
    }>>, unknown>;
    UPI_VPA: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    UPI_PAYEE_NAME: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
    GOOGLE_MAPS_API_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>, unknown>;
}, z.core.$strip>;
export type Env = z.infer<typeof envSchema>;
export declare function validateEnv(config: Record<string, unknown>): Env;
