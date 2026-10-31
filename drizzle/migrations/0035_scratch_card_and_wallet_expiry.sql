-- Expiration for scratch cards: 15 days if not scratched
ALTER TABLE "scratch_cards" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "scratch_cards" ADD COLUMN IF NOT EXISTS "expired_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "scratch_cards" ADD COLUMN IF NOT EXISTS "restored_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "scratch_cards" ADD COLUMN IF NOT EXISTS "admin_notes" text;
--> statement-breakpoint
UPDATE "scratch_cards"
SET "expires_at" = "created_at" + interval '15 days'
WHERE "expires_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scratch_cards_status_expires_idx" ON "scratch_cards" ("status", "expires_at");
--> statement-breakpoint

-- Expiration for wallet amounts: 30 days validity for customer credits
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "remaining_amount" double precision;
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "expired_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "restored_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "wallet_transactions"
SET "remaining_amount" = "amount",
    "expires_at" = "created_at" + interval '30 days'
WHERE "amount" > 0 AND "remaining_amount" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_tx_remaining_expires_idx" ON "wallet_transactions" ("user_id", "remaining_amount", "expires_at");
--> statement-breakpoint

-- Platform settings for defaults:
INSERT INTO "platform_settings" ("key", "value", "description")
VALUES ('scratch_card_unscratched_days', '15', 'Default days before an unscratched scratch card expires (default 15)')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "platform_settings" ("key", "value", "description")
VALUES ('wallet_amount_expiry_days', '30', 'Default days before customer wallet credits expire (default 30)')
ON CONFLICT ("key") DO NOTHING;
