-- Refer & earn: every customer gets a shareable code; a new customer can enter
-- someone's code at sign-up, and that someone is paid 5% of the new customer's
-- first delivered order into their wallet. All columns nullable, so every
-- existing user is untouched (codes are generated on first use).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" varchar(12);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_rewarded_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_referred_by_users_id_fk"
    FOREIGN KEY ("referred_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_idx" ON "users" ("referral_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_referred_by_idx" ON "users" ("referred_by");
--> statement-breakpoint
-- Referrer's reward as a percentage of the referred customer's first order subtotal.
INSERT INTO "platform_settings" ("key", "value", "description")
VALUES ('referral_reward_pct', '5', 'Refer & earn: % of the referred customer''s first order paid to the referrer''s wallet')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- ...but never more than this many rupees per referral.
INSERT INTO "platform_settings" ("key", "value", "description")
VALUES ('referral_reward_max_amount', '15', 'Refer & earn: maximum rupees a single referral can pay the referrer')
ON CONFLICT ("key") DO NOTHING;
