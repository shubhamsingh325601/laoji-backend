ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_price" double precision;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "selling_price" double precision;
ALTER TABLE "vendor_products" ADD COLUMN IF NOT EXISTS "wholesale_price" double precision;
ALTER TABLE "vendor_products" ADD COLUMN IF NOT EXISTS "commission_pct" double precision;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "commission_pct" double precision;
