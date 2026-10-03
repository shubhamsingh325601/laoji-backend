CREATE TABLE IF NOT EXISTS "vendor_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
	"title" varchar(150) NOT NULL,
	"scope" varchar(30) DEFAULT 'entire_store' NOT NULL,
	"product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
	"menu_item_id" uuid REFERENCES "menu_items"("id") ON DELETE SET NULL,
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
CREATE TABLE IF NOT EXISTS "vendor_discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL REFERENCES "vendor_discounts"("id") ON DELETE CASCADE,
	"vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
