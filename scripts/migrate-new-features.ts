import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });
  console.log('Connecting to database...');
  await pool.query(`
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS image_url text;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_type varchar(50) DEFAULT 'grocery';

    ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS vehicle_number varchar(50);
    ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS vehicle_model varchar(100);

    CREATE TABLE IF NOT EXISTS area_managers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(200) NOT NULL,
      email varchar(255) NOT NULL UNIQUE,
      phone varchar(20) NOT NULL,
      pincode varchar(20) NOT NULL DEFAULT '325601',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
  console.log('Successfully applied database migrations for vendors, delivery partners, and area managers.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
