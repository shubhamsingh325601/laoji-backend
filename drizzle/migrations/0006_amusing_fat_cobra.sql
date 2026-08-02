CREATE TYPE "public"."payment_provider" AS ENUM('upi_deeplink', 'cod', 'razorpay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'pending_cod', 'collected');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_order_id" uuid,
	"food_order_id" uuid,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" double precision NOT NULL,
	"upi_deep_link" text,
	"provider_ref" varchar(100),
	"reconciled_by" uuid,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_exactly_one_order_ref" CHECK (("payments"."grocery_order_id" is not null and "payments"."food_order_id" is null) or ("payments"."grocery_order_id" is null and "payments"."food_order_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;