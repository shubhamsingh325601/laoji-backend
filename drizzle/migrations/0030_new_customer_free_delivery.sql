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
