-- Grocery orders can now be rated too: exactly one of food_order_id / grocery_order_id is set.
ALTER TABLE "food_order_ratings" ALTER COLUMN "food_order_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD COLUMN IF NOT EXISTS "grocery_order_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "food_order_ratings"
    ADD CONSTRAINT "food_order_ratings_grocery_order_id_grocery_orders_id_fk"
    FOREIGN KEY ("grocery_order_id") REFERENCES "grocery_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "food_order_ratings"
    ADD CONSTRAINT "food_order_ratings_grocery_order_id_unique" UNIQUE ("grocery_order_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "food_order_ratings"
    ADD CONSTRAINT "food_order_ratings_one_order"
    CHECK (("food_order_id" is not null) <> ("grocery_order_id" is not null));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scratch_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL,
  "order_type" varchar(20) NOT NULL,
  "status" varchar(20) DEFAULT 'unscratched' NOT NULL,
  "amount" integer,
  "scratched_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "scratch_cards_amount_range" CHECK ("amount" is null or "amount" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scratch_cards_order_idx" ON "scratch_cards" ("order_type", "order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scratch_cards_user_idx" ON "scratch_cards" ("user_id", "created_at");
