import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../drizzle/schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type Db = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const pool = new Pool({ connectionString: config.get<string>('DATABASE_URL') });
        try {
          await pool.query(`
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "beneficiary_user_id" uuid;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "show_in_app" boolean NOT NULL DEFAULT true;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "affiliate_commission_type" varchar(20);
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "affiliate_commission_value" double precision;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_uses_per_user" integer;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_total_uses" integer;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "total_redemptions" integer NOT NULL DEFAULT 0;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;
            ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;

            CREATE TABLE IF NOT EXISTS "wallets" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
              "balance" double precision NOT NULL DEFAULT 0,
              "total_earned" double precision NOT NULL DEFAULT 0,
              "total_withdrawn" double precision NOT NULL DEFAULT 0,
              "created_at" timestamp with time zone NOT NULL DEFAULT now(),
              "updated_at" timestamp with time zone NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS "wallet_transactions" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
              "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
              "amount" double precision NOT NULL,
              "type" varchar(30) NOT NULL,
              "status" varchar(20) NOT NULL DEFAULT 'completed',
              "description" text NOT NULL,
              "order_id" uuid,
              "order_type" varchar(20),
              "coupon_code" varchar(50),
              "metadata" jsonb,
              "created_at" timestamp with time zone NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
              "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
              "amount" double precision NOT NULL,
              "payout_method" varchar(20) NOT NULL,
              "upi_id" varchar(100),
              "bank_account" varchar(50),
              "bank_ifsc" varchar(20),
              "account_holder_name" varchar(200),
              "status" varchar(20) NOT NULL DEFAULT 'pending',
              "admin_notes" text,
              "processed_at" timestamp with time zone,
              "created_at" timestamp with time zone NOT NULL DEFAULT now()
            );
          `);
        } catch (err) {
          console.warn('[DB Init] Auto-migration notice:', err);
        }
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
