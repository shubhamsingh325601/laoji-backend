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
            ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "image_url" text;
            UPDATE "vendors" v
            SET "image_url" = r."image_url"
            FROM "restaurants" r
            WHERE r."vendor_id" = v."id"
              AND (v."image_url" IS NULL OR v."image_url" = '')
              AND r."image_url" IS NOT NULL
              AND r."image_url" != '';

            UPDATE "restaurants" r
            SET "image_url" = v."image_url"
            FROM "vendors" v
            WHERE r."vendor_id" = v."id"
              AND (r."image_url" IS NULL OR r."image_url" = '')
              AND v."image_url" IS NOT NULL
              AND v."image_url" != '';

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

            CREATE TABLE IF NOT EXISTS "vendor_discounts" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
              "title" varchar(150) NOT NULL,
              "scope" varchar(30) NOT NULL DEFAULT 'entire_store',
              "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
              "menu_item_id" uuid REFERENCES "menu_items"("id") ON DELETE SET NULL,
              "discount_type" varchar(20) NOT NULL DEFAULT 'percentage',
              "discount_value" double precision NOT NULL DEFAULT 0,
              "max_discount" double precision,
              "min_order_value" double precision NOT NULL DEFAULT 0,
              "total_usage_limit" integer,
              "usage_count" integer NOT NULL DEFAULT 0,
              "per_user_limit" integer NOT NULL DEFAULT 1,
              "start_time" varchar(10),
              "end_time" varchar(10),
              "start_date" date,
              "end_date" date,
              "is_active" boolean NOT NULL DEFAULT true,
              "created_at" timestamp with time zone NOT NULL DEFAULT now(),
              "updated_at" timestamp with time zone NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS "vendor_discount_redemptions" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "discount_id" uuid NOT NULL REFERENCES "vendor_discounts"("id") ON DELETE CASCADE,
              "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
              "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
              "order_id" uuid,
              "created_at" timestamp with time zone NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS "vendor_withdrawals" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
              "amount" double precision NOT NULL,
              "available_before" double precision NOT NULL,
              "status" varchar(20) NOT NULL DEFAULT 'pending',
              "payout_method" varchar(20) NOT NULL,
              "upi_id" varchar(100),
              "bank_account" varchar(50),
              "bank_ifsc" varchar(20),
              "period_start" timestamp with time zone,
              "period_end" timestamp with time zone NOT NULL,
              "rejection_reason" text,
              "payout_reference" varchar(100),
              "processed_by" uuid REFERENCES "users"("id"),
              "processed_at" timestamp with time zone,
              "created_at" timestamp with time zone NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "vendor_withdrawals_one_pending_idx"
              ON "vendor_withdrawals" ("vendor_id") WHERE "status" = 'pending';
            CREATE INDEX IF NOT EXISTS "vendor_withdrawals_vendor_idx"
              ON "vendor_withdrawals" ("vendor_id", "created_at");
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
