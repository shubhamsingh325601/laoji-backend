CREATE TABLE IF NOT EXISTS "rider_payout_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_km" double precision NOT NULL,
	"to_km" double precision,
	"amount" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN IF NOT EXISTS "rider_payout" double precision;
--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "rider_payout" double precision;
--> statement-breakpoint
INSERT INTO "rider_payout_tiers" ("from_km", "to_km", "amount")
SELECT v.from_km, v.to_km, v.amount
FROM (VALUES (0::double precision, 3::double precision, 5::double precision),
             (3, 5, 10),
             (5, NULL, 15)) AS v(from_km, to_km, amount)
WHERE NOT EXISTS (SELECT 1 FROM "rider_payout_tiers");
