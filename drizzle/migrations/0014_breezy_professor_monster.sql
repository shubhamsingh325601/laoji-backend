ALTER TABLE "users" ADD COLUMN "name" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_stuck_orders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_kyc" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "support_notes" text;