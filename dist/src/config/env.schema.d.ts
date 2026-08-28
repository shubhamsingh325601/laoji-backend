import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    PORT: z.ZodPreprocess<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    NODE_ENV: z.ZodPreprocess<z.ZodDefault<z.ZodEnum<{
        development: "development";
        test: "test";
        production: "production";
    }>>>;
    OTP_TEST_MODE: z.ZodPipe<z.ZodOptional<z.ZodPreprocess<z.ZodUnion<readonly [z.ZodBoolean, z.ZodEnum<{
        true: "true";
        false: "false";
    }>, z.ZodString]>>>, z.ZodTransform<boolean, string | boolean | undefined>>;
    CORS_ORIGIN: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    DATABASE_URL: z.ZodPreprocess<z.ZodString>;
    JWT_ACCESS_SECRET: z.ZodPreprocess<z.ZodString>;
    JWT_REFRESH_SECRET: z.ZodPreprocess<z.ZodString>;
    JWT_ACCESS_EXPIRES_IN: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    JWT_REFRESH_EXPIRES_IN: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    CLOUDINARY_CLOUD_NAME: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    CLOUDINARY_API_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    CLOUDINARY_API_SECRET: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    FIREBASE_PROJECT_ID: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    FIREBASE_CLIENT_EMAIL: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    FIREBASE_PRIVATE_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    RESEND_API_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    PAYMENT_PROVIDER: z.ZodPreprocess<z.ZodDefault<z.ZodEnum<{
        upi_deeplink: "upi_deeplink";
        razorpay: "razorpay";
    }>>>;
    UPI_VPA: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    UPI_PAYEE_NAME: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
    GOOGLE_MAPS_API_KEY: z.ZodPreprocess<z.ZodDefault<z.ZodString>>;
}, z.core.$strip>;
export type Env = z.infer<typeof envSchema>;
export declare function validateEnv(config: Record<string, unknown>): Env;
