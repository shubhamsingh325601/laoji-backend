-- Per-device custom push sound (vendors pick a loud alert in the app).
ALTER TABLE "device_tokens" ADD COLUMN IF NOT EXISTS "notification_sound" varchar(40);
