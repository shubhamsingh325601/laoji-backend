CREATE TABLE IF NOT EXISTS "service_areas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "center_lat" double precision NOT NULL,
  "center_lng" double precision NOT NULL,
  "radius_km" double precision DEFAULT 10 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "service_areas" ("name", "center_lat", "center_lng", "radius_km")
SELECT 'Sangod', 24.924, 76.283, 10 WHERE NOT EXISTS (SELECT 1 FROM "service_areas");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_min_order_tiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_km" double precision NOT NULL,
  "to_km" double precision,
  "min_order_amount" double precision NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "outer_zone_radius_km" double precision DEFAULT 2 NOT NULL,
  "outer_zone_fee" double precision DEFAULT 15 NOT NULL,
  "long_distance_km" double precision DEFAULT 5 NOT NULL,
  "long_distance_free_min" double precision DEFAULT 200 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "splash_settings" (
  "app" varchar(20) PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "image_url" text,
  "duration_ms" integer DEFAULT 2800 NOT NULL,
  "skippable" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
