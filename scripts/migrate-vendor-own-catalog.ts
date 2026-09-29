// Applies migration 0020 (vendor-owned categories, product template links,
// category suggestions) idempotently, the same way
// migrate-meal-slots-restock-catalog.ts applies 0019:
//   npx ts-node scripts/migrate-vendor-own-catalog.ts
//
// Existing categories all stay Laoji categories: nothing recorded which
// vendor created one, so none is handed to a vendor here.
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });
  console.log('Connecting to database...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS category_suggestions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      vendor_id uuid NOT NULL,
      name varchar(150) NOT NULL,
      business_type varchar(50) NOT NULL,
      note text,
      status product_suggestion_status DEFAULT 'pending' NOT NULL,
      rejection_reason text,
      category_id uuid,
      reviewed_by uuid,
      reviewed_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS owner_vendor_id uuid;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS template_category_id uuid;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS template_product_id uuid;
    DO $$ BEGIN
      ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_vendor_id_vendors_id_fk
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_category_id_categories_id_fk
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_reviewed_by_users_id_fk
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      ALTER TABLE categories ADD CONSTRAINT categories_owner_vendor_id_vendors_id_fk
        FOREIGN KEY (owner_vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      ALTER TABLE categories ADD CONSTRAINT categories_template_category_id_categories_id_fk
        FOREIGN KEY (template_category_id) REFERENCES categories(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      ALTER TABLE products ADD CONSTRAINT products_template_product_id_products_id_fk
        FOREIGN KEY (template_product_id) REFERENCES products(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('Applied vendor category ownership, product template links and category suggestions.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
