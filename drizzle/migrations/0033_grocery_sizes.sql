-- Grocery sizes: an item sold in several sizes is one product per size, all
-- sharing variant_group_id; variant_label is the size shown to buyers.
-- Both nullable, so every existing product stays standalone.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variant_group_id" uuid;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variant_label" varchar(50);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_variant_group_idx" ON "products" ("variant_group_id");
--> statement-breakpoint
-- Off until an admin turns it on (Admin -> catalog features).
INSERT INTO "platform_settings" ("key", "value", "description")
VALUES ('grocery_sizes_enabled', 'false', 'Lets admins sell grocery items in several sizes')
ON CONFLICT ("key") DO NOTHING;
