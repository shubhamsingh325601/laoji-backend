CREATE TYPE "public"."delivery_assignment_outcome" AS ENUM('pending', 'accepted', 'rejected', 'timeout');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivery_assigned' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'picked_up' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'out_for_delivery' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivered' BEFORE 'failed';--> statement-breakpoint
CREATE TABLE "delivery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grocery_order_id" uuid,
	"food_order_id" uuid,
	"delivery_partner_id" uuid NOT NULL,
	"outcome" "delivery_assignment_outcome" DEFAULT 'pending' NOT NULL,
	"attempt_no" integer NOT NULL,
	"sla_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_assignments_exactly_one_order_ref" CHECK (("delivery_assignments"."grocery_order_id" is not null and "delivery_assignments"."food_order_id" is null) or ("delivery_assignments"."grocery_order_id" is null and "delivery_assignments"."food_order_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "delivery_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kyc_status" "kyc_document_status" DEFAULT 'pending' NOT NULL,
	"vehicle_type" varchar(30) NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"current_lat" double precision,
	"current_lng" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_partners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "delivery_partner_id" uuid;--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "delivery_otp" varchar(6);--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "delivery_partner_id" uuid;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "delivery_otp" varchar(6);--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_grocery_order_id_grocery_orders_id_fk" FOREIGN KEY ("grocery_order_id") REFERENCES "public"."grocery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_food_order_id_food_orders_id_fk" FOREIGN KEY ("food_order_id") REFERENCES "public"."food_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD CONSTRAINT "grocery_orders_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;