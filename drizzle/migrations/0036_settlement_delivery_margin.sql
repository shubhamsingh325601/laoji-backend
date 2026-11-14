ALTER TABLE "settlements" ADD COLUMN IF NOT EXISTS "delivery_margin" double precision DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "settlements" s SET "delivery_margin" = GREATEST(0, o.delivery_fee - CASE WHEN c.discount_type = 'free_delivery' THEN COALESCE(o.discount, 0) ELSE 0 END)
FROM "grocery_orders" o LEFT JOIN "coupons" c ON c.code = o.coupon_code WHERE s.grocery_order_id = o.id AND s.delivery_margin = 0;
--> statement-breakpoint
UPDATE "settlements" s SET "delivery_margin" = GREATEST(0, o.delivery_fee - CASE WHEN c.discount_type = 'free_delivery' THEN COALESCE(o.discount, 0) ELSE 0 END)
FROM "food_orders" o LEFT JOIN "coupons" c ON c.code = o.coupon_code WHERE s.food_order_id = o.id AND s.delivery_margin = 0;
