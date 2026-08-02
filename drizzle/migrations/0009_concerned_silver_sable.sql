CREATE TYPE "public"."revenue_config_scope" AS ENUM('global', 'category', 'vendor');--> statement-breakpoint
CREATE TABLE "revenue_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "revenue_config_scope" NOT NULL,
	"scope_ref_id" uuid,
	"commission_pct" double precision NOT NULL,
	"delivery_fee_flat" double precision NOT NULL,
	"cod_threshold" double precision,
	"effective_from" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_order_id" uuid,
	"food_order_id" uuid,
	"vendor_payout" double precision NOT NULL,
	"delivery_payout" double precision NOT NULL,
	"platform_share" double precision NOT NULL,
	"commission_pct_snapshot" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_exactly_one_order_ref" CHECK (("settlements"."grocery_order_id" is not null and "settlements"."food_order_id" is null) or ("settlements"."grocery_order_id" is null and "settlements"."food_order_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "commission_pct" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "commission_pct" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "revenue_config" ADD CONSTRAINT "revenue_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE cascade ON UPDATE no action;