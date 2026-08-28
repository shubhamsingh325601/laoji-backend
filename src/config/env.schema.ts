import { z } from 'zod';

const cleanString = (val: unknown) => {
  if (typeof val === 'string') {
    return val.replace(/^["']|["']$/g, '').trim();
  }
  return val;
};

export const envSchema = z.object({
  PORT: z.preprocess(cleanString, z.coerce.number().default(3000)),
  NODE_ENV: z.preprocess(cleanString, z.enum(['development', 'test', 'production']).default('development')),
  OTP_TEST_MODE: z
    .preprocess(cleanString, z.union([z.boolean(), z.enum(['true', 'false']), z.string()]))
    .optional()
    .transform((v) => v === true || v === 'true'),
  CORS_ORIGIN: z.preprocess(cleanString, z.string().default('http://localhost:8080')),

  DATABASE_URL: z.preprocess(cleanString, z.string().min(1, 'DATABASE_URL is required')),

  JWT_ACCESS_SECRET: z.preprocess(cleanString, z.string().min(1, 'JWT_ACCESS_SECRET is required')),
  JWT_REFRESH_SECRET: z.preprocess(cleanString, z.string().min(1, 'JWT_REFRESH_SECRET is required')),
  JWT_ACCESS_EXPIRES_IN: z.preprocess(cleanString, z.string().default('15m')),
  JWT_REFRESH_EXPIRES_IN: z.preprocess(cleanString, z.string().default('30d')),

  CLOUDINARY_CLOUD_NAME: z.preprocess(cleanString, z.string().default('')),
  CLOUDINARY_API_KEY: z.preprocess(cleanString, z.string().default('')),
  CLOUDINARY_API_SECRET: z.preprocess(cleanString, z.string().default('')),

  FIREBASE_PROJECT_ID: z.preprocess(cleanString, z.string().default('')),
  FIREBASE_CLIENT_EMAIL: z.preprocess(cleanString, z.string().default('')),
  FIREBASE_PRIVATE_KEY: z.preprocess(cleanString, z.string().default('')),

  RESEND_API_KEY: z.preprocess(cleanString, z.string().default('')),

  PAYMENT_PROVIDER: z.preprocess(cleanString, z.enum(['upi_deeplink', 'razorpay']).default('upi_deeplink')),
  UPI_VPA: z.preprocess(cleanString, z.string().default('laoji@upi')),
  UPI_PAYEE_NAME: z.preprocess(cleanString, z.string().default('Laoji')),

  GOOGLE_MAPS_API_KEY: z.preprocess(cleanString, z.string().default('')),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    console.error('Environment validation failed with errors:', parsed.error.format());
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}
