-- Idempotent: the same changes can already be in place from
-- scripts/migrate-vendor-own-catalog.ts.
CREATE TABLE IF NOT EXISTS "category_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"business_type" varchar(50) NOT NULL,
	"note" text,
	"status" "product_suggestion_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"category_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "owner_vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "template_category_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "template_product_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_owner_vendor_id_vendors_id_fk" FOREIGN KEY ("owner_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "categories" ADD CONSTRAINT "categories_template_category_id_categories_id_fk" FOREIGN KEY ("template_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_template_product_id_products_id_fk" FOREIGN KEY ("template_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
