CREATE TABLE IF NOT EXISTS "vendor_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
	"amount" double precision NOT NULL,
	"available_before" double precision NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payout_method" varchar(20) NOT NULL,
	"upi_id" varchar(100),
	"bank_account" varchar(50),
	"bank_ifsc" varchar(20),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone NOT NULL,
	"rejection_reason" text,
	"payout_reference" varchar(100),
	"processed_by" uuid REFERENCES "users"("id"),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_withdrawals_one_pending_idx" ON "vendor_withdrawals" ("vendor_id") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_withdrawals_vendor_idx" ON "vendor_withdrawals" ("vendor_id", "created_at");
