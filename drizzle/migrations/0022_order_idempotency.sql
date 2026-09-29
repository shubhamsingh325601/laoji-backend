-- Idempotent migration for order deduplication and idempotency keys
ALTER TABLE "grocery_orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120);--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "grocery_orders_customer_idempotency_idx" ON "grocery_orders" ("customer_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "food_orders_customer_idempotency_idx" ON "food_orders" ("customer_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
