-- Idempotent: the same changes can already be in place from
-- scripts/migrate-offers-vouchers-banners.ts.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "first_n_orders" integer;--> statement-breakpoint
ALTER TABLE "revenue_config" ADD COLUMN IF NOT EXISTS "min_order_value" double precision DEFAULT 50;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN IF NOT EXISTS "coupon_code" varchar(50);--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN IF NOT EXISTS "discount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "coupon_code" varchar(50);--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "discount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "banners" (
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
);--> statement-breakpoint
-- Product decision: new customers get free delivery on their first 3 orders
-- (min ₹50), and the FIRST10 voucher is retired.
INSERT INTO "coupons" ("code", "discount_type", "discount_value", "min_order_value", "description", "first_n_orders", "is_active")
VALUES ('FREEDEL3', 'free_delivery', 0, 50, 'Free delivery on your first 3 orders', 3, true)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
DELETE FROM "coupons" WHERE "code" = 'FIRST10';
