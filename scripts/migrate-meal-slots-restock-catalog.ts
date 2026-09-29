// Applies migration 0019 (menu item meal slots, restaurant meal timings,
// vendor listing restock fields, products.owner_vendor_id) idempotently, the
// same way migrate-new-features.ts was used for earlier columns:
//   npx ts-node scripts/migrate-meal-slots-restock-catalog.ts
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });
  console.log('Connecting to database...');
  await pool.query(`
    ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS meal_slots jsonb;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meal_timings jsonb;
    ALTER TABLE vendor_products ADD COLUMN IF NOT EXISTS restock_eta date;
    ALTER TABLE vendor_products ADD COLUMN IF NOT EXISTS last_restocked_at timestamp with time zone;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_vendor_id uuid;
    DO $$ BEGIN
      ALTER TABLE products ADD CONSTRAINT products_owner_vendor_id_vendors_id_fk
        FOREIGN KEY (owner_vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('Applied meal slot, restock and product owner columns.');

  // Products made with the Vendor app's add-product form always carry
  // `attributes` (admin-created, seeded and approved-suggestion products
  // never do). Each one stocked by exactly one vendor becomes that vendor's own.
  const backfill = await pool.query(`
    UPDATE products SET owner_vendor_id = sole.vendor_id
    FROM (
      SELECT product_id, (array_agg(vendor_id))[1] AS vendor_id
      FROM vendor_products
      GROUP BY product_id
      HAVING count(*) = 1
    ) AS sole
    WHERE products.id = sole.product_id
      AND products.attributes IS NOT NULL
      AND products.owner_vendor_id IS NULL
    RETURNING products.id, products.name, products.owner_vendor_id
  `);
  console.log(`Marked ${backfill.rowCount} vendor-created products as their vendor's own:`);
  console.table(backfill.rows);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
