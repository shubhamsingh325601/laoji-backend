import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });
  console.log('Connecting to database...');
  await pool.query(`
    ALTER TABLE revenue_config ADD COLUMN IF NOT EXISTS free_delivery_threshold double precision DEFAULT 99;
    ALTER TABLE revenue_config ADD COLUMN IF NOT EXISTS delivery_fee_tier1 double precision DEFAULT 10;
    ALTER TABLE revenue_config ADD COLUMN IF NOT EXISTS delivery_fee_tier2 double precision DEFAULT 15;
    ALTER TABLE revenue_config ADD COLUMN IF NOT EXISTS delivery_fee_tier3 double precision DEFAULT 20;
  `);
  console.log('Successfully added tiered delivery fee columns to revenue_config table.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
