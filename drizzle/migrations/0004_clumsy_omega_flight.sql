CREATE TYPE "public"."actor_role" AS ENUM('customer', 'vendor', 'delivery_partner', 'system', 'admin');--> statement-breakpoint
CREATE TYPE "public"."allocation_outcome" AS ENUM('pending', 'accepted', 'rejected', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('placed', 'vendor_accepted', 'preparing', 'ready', 'handed_over', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "allocation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"outcome" "allocation_outcome" DEFAULT 'pending' NOT NULL,
	"attempt_no" integer NOT NULL,
	"sla_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" double precision NOT NULL,
	"addons_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "food_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'placed' NOT NULL,
	"subtotal" double precision NOT NULL,
	"delivery_fee" double precision DEFAULT 0 NOT NULL,
	"platform_commission" double precision DEFAULT 0 NOT NULL,
	"total" double precision NOT NULL,
	"payment_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"delivery_address_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'placed' NOT NULL,
	"subtotal" double precision NOT NULL,
	"delivery_fee" double precision DEFAULT 0 NOT NULL,
	"platform_commission" double precision DEFAULT 0 NOT NULL,
	"total" double precision NOT NULL,
	"payment_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"vendor_id" uuid,
	"delivery_address_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_order_id" uuid,
	"food_order_id" uuid,
	"status" "order_status" NOT NULL,
	"actor_role" "actor_role" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_status_history_exactly_one_order_ref" CHECK (("order_status_history"."grocery_order_id" is not null and "order_status_history"."food_order_id" is null) or ("order_status_history"."grocery_order_id" is null and "order_status_history"."food_order_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "allocation_attempts" ADD CONSTRAINT "allocation_attempts_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_attempts" ADD CONSTRAINT "allocation_attempts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_items" ADD CONSTRAINT "food_order_items_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_order_items" ADD CONSTRAINT "food_order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_delivery_address_id_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_order_items" ADD CONSTRAINT "grocery_order_items_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_order_items" ADD CONSTRAINT "grocery_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD CONSTRAINT "grocery_orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD CONSTRAINT "grocery_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD CONSTRAINT "grocery_orders_delivery_address_id_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;