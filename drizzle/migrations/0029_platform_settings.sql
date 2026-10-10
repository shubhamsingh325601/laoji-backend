-- Dynamic platform configurations (e.g. vendor minimum withdrawal limit)
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" varchar(100) PRIMARY KEY,
  "value" text NOT NULL,
  "description" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "users"("id")
);

INSERT INTO "platform_settings" ("key", "value", "description")
VALUES ('vendor_min_withdrawal_limit', '500', 'Default minimum withdrawal limit for vendors in INR')
ON CONFLICT ("key") DO NOTHING;
