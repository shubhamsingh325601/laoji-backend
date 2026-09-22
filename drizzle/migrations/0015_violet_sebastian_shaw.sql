CREATE TABLE "area_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"pincode" varchar(20) DEFAULT '325601' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "area_managers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "vehicle_number" varchar(50);--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "vehicle_model" varchar(100);--> statement-breakpoint
ALTER TABLE "revenue_config" ADD COLUMN "free_delivery_threshold" double precision DEFAULT 99;--> statement-breakpoint
ALTER TABLE "revenue_config" ADD COLUMN "delivery_fee_tier1" double precision DEFAULT 10;--> statement-breakpoint
ALTER TABLE "revenue_config" ADD COLUMN "delivery_fee_tier2" double precision DEFAULT 15;--> statement-breakpoint
ALTER TABLE "revenue_config" ADD COLUMN "delivery_fee_tier3" double precision DEFAULT 20;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD COLUMN "offer_tag" varchar(100);--> statement-breakpoint
ALTER TABLE "vendor_products" ADD COLUMN "low_stock_threshold" integer;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "business_type" varchar(50) DEFAULT 'grocery' NOT NULL;