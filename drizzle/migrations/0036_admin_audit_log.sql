-- Append-only record of everything admins do (writes, plus admin sign-ins).
-- admin_id has no foreign key on purpose: the entry must survive the account,
-- and admin_email / admin_name keep who it was at the time.
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "event_type" varchar(20) NOT NULL DEFAULT 'action',
  "admin_id" uuid,
  "admin_email" varchar(255),
  "admin_name" varchar(200),
  "method" varchar(10) NOT NULL,
  "route" varchar(300) NOT NULL,
  "path" varchar(500) NOT NULL,
  "resource" varchar(60) NOT NULL,
  "action" varchar(80) NOT NULL,
  "target_id" varchar(64),
  "outcome" varchar(10) NOT NULL DEFAULT 'success',
  "status_code" integer,
  "error_message" text,
  "params" jsonb,
  "body" jsonb,
  "ip" varchar(64),
  "user_agent" varchar(300),
  "duration_ms" integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx" ON "admin_audit_log" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_admin_idx" ON "admin_audit_log" ("admin_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_log_resource_idx" ON "admin_audit_log" ("resource", "created_at" DESC);
