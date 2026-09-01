ALTER TYPE "public"."notification_channel" ADD VALUE 'sms';--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "aadhaar_number" varchar(20);--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "driving_license" varchar(50);--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "bank_account" varchar(50);--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "bank_ifsc" varchar(20);--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "upi_id" varchar(100);--> statement-breakpoint
ALTER TABLE "food_orders" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "grocery_orders" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "shop_address" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "gst_number" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "aadhaar_number" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "bank_account" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "bank_ifsc" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "upi_id" varchar(100);