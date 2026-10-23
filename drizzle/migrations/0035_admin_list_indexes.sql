-- Indexes for the admin panel's list/stat queries. Postgres does not index
-- foreign-key columns on its own, so order items, status history, settlements
-- and assignments were all being found by scanning the whole table. Nothing
-- here changes data or behaviour; every statement is IF NOT EXISTS.

-- Orders: list ordered by newest, filtered by status / payment, per customer /
-- vendor / restaurant / rider.
CREATE INDEX IF NOT EXISTS "grocery_orders_created_at_idx" ON "grocery_orders" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_orders_status_idx" ON "grocery_orders" ("status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_orders_payment_status_idx" ON "grocery_orders" ("payment_status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_orders_customer_idx" ON "grocery_orders" ("customer_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_orders_vendor_idx" ON "grocery_orders" ("vendor_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grocery_orders_partner_idx" ON "grocery_orders" ("delivery_partner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_orders_created_at_idx" ON "food_orders" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_orders_status_idx" ON "food_orders" ("status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_orders_payment_status_idx" ON "food_orders" ("payment_status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_orders_customer_idx" ON "food_orders" ("customer_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_orders_restaurant_idx" ON "food_orders" ("restaurant_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_orders_partner_idx" ON "food_orders" ("delivery_partner_id");
--> statement-breakpoint

-- Rows that hang off an order.
CREATE INDEX IF NOT EXISTS "grocery_order_items_order_idx" ON "grocery_order_items" ("grocery_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "food_order_items_order_idx" ON "food_order_items" ("food_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_grocery_idx" ON "order_status_history" ("grocery_order_id", "changed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_food_idx" ON "order_status_history" ("food_order_id", "changed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "allocation_attempts_order_idx" ON "allocation_attempts" ("grocery_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "allocation_attempts_vendor_idx" ON "allocation_attempts" ("vendor_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignments_grocery_idx" ON "delivery_assignments" ("grocery_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignments_food_idx" ON "delivery_assignments" ("food_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignments_partner_idx" ON "delivery_assignments" ("delivery_partner_id", "outcome");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlements_grocery_idx" ON "settlements" ("grocery_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlements_food_idx" ON "settlements" ("food_order_id");
--> statement-breakpoint

-- Notification log and wallet ledger (admin lists, per-user history).
CREATE INDEX IF NOT EXISTS "notification_log_created_at_idx" ON "notification_log" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_log_user_idx" ON "notification_log" ("user_id", "created_at" DESC);
--> statement-breakpoint
-- wallet_transactions is created by the backend's own start-up SQL rather than
-- an earlier migration, so on a database the app has never started against it
-- may not exist yet; skip rather than fail.
DO $$ BEGIN
  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "wallet_transactions_user_idx" ON "wallet_transactions" ("user_id", "created_at" DESC);
    CREATE INDEX IF NOT EXISTS "wallet_transactions_created_at_idx" ON "wallet_transactions" ("created_at" DESC);
  END IF;
END $$;
--> statement-breakpoint

-- Users: admin lists filter by role and sort by newest.
CREATE INDEX IF NOT EXISTS "users_role_created_at_idx" ON "users" ("role", "created_at" DESC);
