import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });
  console.log('Connecting to database...');

  await pool.query(`
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS show_in_app boolean NOT NULL DEFAULT true;
    ALTER TABLE vendors ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
  `);

  console.log('Added show_in_app and display_order columns to vendors table.');

  // Set initial display orders based on known curated sequence
  const initialOrder = [
    { pattern: '%golden cafe%', order: 1 },
    { pattern: '%mehta fruit%', order: 2 },
    { pattern: '%jai bhawani%', order: 3 },
    { pattern: '%om misthan%', order: 4 },
    { pattern: '%mahakal flower%', order: 5 },
    { pattern: '%evening bites%', order: 6 },
    { pattern: '%vrk hotel%', order: 7 },
    { pattern: '%nagar bakery%', order: 8 },
    { pattern: '%chaska point%', order: 9 },
    { pattern: '%rj 20%', order: 10 },
    { pattern: '%ganpati kirana%', order: 11 },
  ];

  await pool.query(`UPDATE vendors SET display_order = 1000;`);

  for (const item of initialOrder) {
    await pool.query(
      `UPDATE vendors SET display_order = $1 WHERE business_name ILIKE $2`,
      [item.order, item.pattern]
    );
  }

  // Ensure all vendors have distinct subsequent display_order
  await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY display_order ASC, created_at ASC) as rnk
      FROM vendors
    )
    UPDATE vendors v
    SET display_order = r.rnk
    FROM ranked r
    WHERE v.id = r.id;
  `);

  // Synchronize show_in_app with is_open for existing data so far
  await pool.query(`
    UPDATE vendors SET show_in_app = is_open;
  `);

  const res = await pool.query(
    `SELECT id, business_name, is_open, show_in_app, display_order FROM vendors ORDER BY display_order ASC`
  );
  console.log('Vendors after migration:');
  console.table(res.rows);

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
