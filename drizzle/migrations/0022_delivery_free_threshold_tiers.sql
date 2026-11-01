ALTER TYPE "public"."payment_provider" ADD VALUE 'wallet';--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(150) NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"link" text,
	"placement" varchar(20) DEFAULT 'home' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_delivery_fee_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_km" double precision NOT NULL,
	"to_km" double precision,
	"amount" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_free_delivery_bonus" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"extra_orders" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_free_threshold_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_km" double precision NOT NULL,
	"to_km" double precision,
	"min_order_amount" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "new_customer_delivery_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"max_km" double precision DEFAULT 5 NOT NULL,
	"max_orders" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rider_payout_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_km" double precision NOT NULL,
	"to_km" double precision,
	"amount" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scratch_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'unscratched' NOT NULL,
	"amount" integer,
	"scratched_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"restored_at" timestamp with time zone,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scratch_cards_amount_range" CHECK ("scratch_cards"."amount" is null or "scratch_cards"."amount" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "vendor_discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"title" varchar(150) NOT NULL,
	"scope" varchar(30) DEFAULT 'entire_store' NOT NULL,
	"product_id" uuid,
	"menu_item_id" uuid,
	"discount_type" varchar(20) DEFAULT 'percentage' NOT NULL,
	"discount_value" double precision DEFAULT 0 NOT NULL,
	"max_discount" double precision,
	"min_order_value" double precision DEFAULT 0 NOT NULL,
	"total_usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"start_time" varchar(10),
	"end_time" varchar(10),
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"available_before" double precision NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payout_method" varchar(20) NOT NULL,
	"upi_id" varchar(100),
	"bank_account" varchar(50),
	"bank_ifsc" varchar(20),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone NOT NULL,
	"rejection_reason" text,
	"payout_reference" varchar(100),
	"processed_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"remaining_amount" double precision,
	"expires_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"restored_at" timestamp with time zone,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"description" text NOT NULL,
	"order_id" uuid,
	"order_type" varchar(20),
	"coupon_code" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"total_earned" double precision DEFAULT 0 NOT NULL,
	"total_withdrawn" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"payout_method" varchar(20) NOT NULL,
	"upi_id" varchar(100),
	"bank_account" varchar(50),
	"bank_ifsc" varchar(20),
	"account_holder_name" varchar(200),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_order_ratings" ALTER COLUMN "food_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "first_n_orders" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "beneficiary_user_id" uuid;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "show_in_app" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "affiliate_commission_type" varchar(20);--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "affiliate_commission_value" double precision;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "max_uses_per_user" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "max_total_uses" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "total_redemptions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD COLUMN "notification_sound" varchar(40);--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD COLUMN "grocery_order_id" uuid;--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "idempotency_key" varchar(120);--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "rider_payout" double precision;--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "wallet_amount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "coupon_code" varchar(50);--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "discount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "payment_method" varchar(30);--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "idempotency_key" varchar(120);--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "rider_payout" double precision;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "wallet_amount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "coupon_code" varchar(50);--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "discount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "payment_method" varchar(30);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "commission_pct" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "wholesale_price" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "selling_price" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variant_label" varchar(50);--> statement-breakpoint
ALTER TABLE "revenue_config" ADD COLUMN "min_order_value" double precision DEFAULT 50;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" varchar(12);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_rewarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD COLUMN "wholesale_price" double precision;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD COLUMN "commission_pct" double precision;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "show_in_app" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "schedule_state" boolean;--> statement-breakpoint
ALTER TABLE "customer_free_delivery_bonus" ADD CONSTRAINT "customer_free_delivery_bonus_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scratch_cards" ADD CONSTRAINT "scratch_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_discount_redemptions" ADD CONSTRAINT "vendor_discount_redemptions_discount_id_vendor_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."vendor_discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_discount_redemptions" ADD CONSTRAINT "vendor_discount_redemptions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_discount_redemptions" ADD CONSTRAINT "vendor_discount_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_discounts" ADD CONSTRAINT "vendor_discounts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_discounts" ADD CONSTRAINT "vendor_discounts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_discounts" ADD CONSTRAINT "vendor_discounts_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_withdrawals" ADD CONSTRAINT "vendor_withdrawals_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_withdrawals" ADD CONSTRAINT "vendor_withdrawals_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scratch_cards_order_idx" ON "scratch_cards" USING btree ("order_type","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_withdrawals_one_pending_idx" ON "vendor_withdrawals" USING btree ("vendor_id") WHERE "vendor_withdrawals"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD CONSTRAINT "food_order_ratings_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_orders_customer_idempotency_idx" ON "food_orders" USING btree ("customer_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_orders_customer_idempotency_idx" ON "grocery_orders" USING btree ("customer_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_code_idx" ON "users" USING btree ("referral_code");--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD CONSTRAINT "food_order_ratings_grocery_order_id_unique" UNIQUE("grocery_order_id");--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD CONSTRAINT "food_order_ratings_one_order" CHECK (("food_order_ratings"."food_order_id" is not null) <> ("food_order_ratings"."grocery_order_id" is not null));