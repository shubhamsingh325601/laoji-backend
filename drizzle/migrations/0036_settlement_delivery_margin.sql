ALTER TABLE "settlements" ADD COLUMN IF NOT EXISTS "delivery_margin" double precision DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "settlements" s SET "delivery_margin" = o.delivery_fee
FROM "grocery_orders" o WHERE s.grocery_order_id = o.id AND s.delivery_margin = 0;
--> statement-breakpoint
UPDATE "settlements" s SET "delivery_margin" = o.delivery_fee
FROM "food_orders" o WHERE s.food_order_id = o.id AND s.delivery_margin = 0;
