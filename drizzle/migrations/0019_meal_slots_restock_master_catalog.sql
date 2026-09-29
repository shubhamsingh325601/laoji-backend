-- Idempotent: coupons was created outside the migration chain on some
-- databases, and these columns may already exist from
-- scripts/migrate-meal-slots-restock-catalog.ts.
CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_type" varchar(20) DEFAULT 'flat' NOT NULL,
	"discount_value" double precision DEFAULT 0 NOT NULL,
	"min_order_value" double precision DEFAULT 0 NOT NULL,
	"max_discount" double precision,
	"description" text,
	"is_first_order_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "meal_slots" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "owner_vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "meal_timings" jsonb;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD COLUMN IF NOT EXISTS "restock_eta" date;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD COLUMN IF NOT EXISTS "last_restocked_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_owner_vendor_id_vendors_id_fk" FOREIGN KEY ("owner_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Products made with the Vendor app's add-product form always carry
-- `attributes` (admin-created, seeded and approved-suggestion products never
-- do). Each one stocked by exactly one vendor becomes that vendor's own.
UPDATE "products" SET "owner_vendor_id" = "sole"."vendor_id"
FROM (
	SELECT "product_id", (array_agg("vendor_id"))[1] AS "vendor_id"
	FROM "vendor_products"
	GROUP BY "product_id"
	HAVING count(*) = 1
) AS "sole"
WHERE "products"."id" = "sole"."product_id"
	AND "products"."attributes" IS NOT NULL
	AND "products"."owner_vendor_id" IS NULL;
