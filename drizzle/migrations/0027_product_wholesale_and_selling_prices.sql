ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_price" double precision;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "selling_price" double precision;
ALTER TABLE "vendor_products" ADD COLUMN IF NOT EXISTS "wholesale_price" double precision;
