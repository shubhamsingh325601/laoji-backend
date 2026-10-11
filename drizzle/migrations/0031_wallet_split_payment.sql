ALTER TABLE "grocery_orders" ADD COLUMN IF NOT EXISTS "wallet_amount" double precision DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "wallet_amount" double precision DEFAULT 0 NOT NULL;
