CREATE TABLE "food_order_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_order_ratings_food_order_id_unique" UNIQUE("food_order_id"),
	CONSTRAINT "food_order_ratings_rating_range" CHECK ("food_order_ratings"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "business_hours" jsonb;--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD CONSTRAINT "food_order_ratings_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD CONSTRAINT "food_order_ratings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_ratings" ADD CONSTRAINT "food_order_ratings_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;