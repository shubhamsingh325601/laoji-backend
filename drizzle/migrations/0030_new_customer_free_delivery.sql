CREATE TABLE IF NOT EXISTS "new_customer_delivery_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"max_km" double precision DEFAULT 5 NOT NULL,
	"max_orders" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "new_customer_delivery_settings" ("enabled", "max_km", "max_orders")
SELECT true, 5, 3
WHERE NOT EXISTS (SELECT 1 FROM "new_customer_delivery_settings");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_free_delivery_bonus" (
	"customer_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
	"extra_orders" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_delivery_fee_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_km" double precision NOT NULL,
	"to_km" double precision,
	"amount" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
