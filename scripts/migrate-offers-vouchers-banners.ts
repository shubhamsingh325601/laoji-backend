// Applies migration 0021 (vouchers, min order value, banners) to a hosted
// database: npx ts-node scripts/migrate-offers-vouchers-banners.ts
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL });
  const sql = readFileSync(join(__dirname, '../drizzle/migrations/0021_offers_vouchers_banners.sql'), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) await pool.query(statement);
  }
  const res = await pool.query(`SELECT code, discount_type, min_order_value, first_n_orders, is_active FROM coupons ORDER BY created_at`);
  console.table(res.rows);
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
