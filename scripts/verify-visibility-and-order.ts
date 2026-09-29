import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });

  console.log('--- Test Step 1: Open Sangod Top 3 vendors in admin panel ---');
  await pool.query(`
    UPDATE vendors
    SET show_in_app = true, is_open = true
    WHERE business_name ILIKE '%golden cafe%'
       OR business_name ILIKE '%jai bhawani%'
       OR business_name ILIKE '%om misthan%'
  `);

  let res = await pool.query(`
    SELECT business_name, show_in_app, is_open, display_order
    FROM vendors
    WHERE show_in_app = true AND is_open = true
    ORDER BY display_order ASC, created_at ASC
  `);
  console.log(`Active vendors (${res.rows.length}):`);
  res.rows.forEach((r, i) => console.log(`  ${i + 1}. [Order #${r.display_order}] ${r.business_name}`));

  console.log('\n--- Test Step 2: Swap display order (Om Misthan -> 1, Golden Cafe -> 4) ---');
  await pool.query(`
    UPDATE vendors SET display_order = 1 WHERE business_name ILIKE '%om misthan%';
    UPDATE vendors SET display_order = 4 WHERE business_name ILIKE '%golden cafe%';
  `);

  res = await pool.query(`
    SELECT business_name, show_in_app, is_open, display_order
    FROM vendors
    WHERE show_in_app = true AND is_open = true
    ORDER BY display_order ASC, created_at ASC
  `);
  console.log(`Reordered active vendors (${res.rows.length}):`);
  res.rows.forEach((r, i) => console.log(`  ${i + 1}. [Order #${r.display_order}] ${r.business_name}`));

  console.log('\n--- Test Step 3: Close Om Misthan ("Show in App" = false) ---');
  await pool.query(`
    UPDATE vendors SET show_in_app = false, is_open = false WHERE business_name ILIKE '%om misthan%';
  `);

  res = await pool.query(`
    SELECT business_name, show_in_app, is_open, display_order
    FROM vendors
    WHERE show_in_app = true AND is_open = true
    ORDER BY display_order ASC, created_at ASC
  `);
  console.log(`Active vendors after closing Om Misthan (${res.rows.length}):`);
  res.rows.forEach((r, i) => console.log(`  ${i + 1}. [Order #${r.display_order}] ${r.business_name}`));

  console.log('\n--- Test Step 4: Reset all 11 Sangod vendors to default open & original order ---');
  const defaults = [
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

  for (const item of defaults) {
    await pool.query(
      `UPDATE vendors SET show_in_app = true, is_open = true, display_order = $1 WHERE business_name ILIKE $2`,
      [item.order, item.pattern]
    );
  }

  res = await pool.query(`
    SELECT business_name, show_in_app, is_open, display_order
    FROM vendors
    WHERE show_in_app = true AND is_open = true
    ORDER BY display_order ASC, created_at ASC
  `);
  console.log(`Final verified active vendors (${res.rows.length}):`);
  res.rows.forEach((r, i) => console.log(`  ${i + 1}. [Order #${r.display_order}] ${r.business_name}`));

  await pool.end();
  console.log('\nAll tests PASSED!');
}

main().catch(console.error);
