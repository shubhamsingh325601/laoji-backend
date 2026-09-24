import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

async function run() {
  const config = parse(process.env.DATABASE_URL!);
  const [{ address }] = await dns.lookup(config.host!, { all: true });
  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: { servername: config.host || undefined, rejectUnauthorized: false },
  });
  await client.connect();

  console.log('=== VERIFYING NEW CATEGORIES & PRODUCTS ===');
  const catSummary = await client.query(`
    SELECT 
      c.id, 
      c.name, 
      c.business_type, 
      p_cat.name as parent_name,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN categories p_cat ON p_cat.id = c.parent_id
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.name IN (
      'Personal Care / Bath & Cleaning',
      'Coffee',
      'Hair / Amla / Hair Oils',
      'Tea',
      'Cooking Oils',
      'Spices & Masala',
      'Dry Fruits',
      'Rice / Flour / Grain',
      'Pulses / Dal',
      'Dairy / Sweets / Snacks',
      'Sugar / Salt / Basic Grocery',
      'Oral Care'
    )
    GROUP BY c.id, c.name, c.business_type, p_cat.name
    ORDER BY c.name
  `);
  console.table(catSummary.rows);

  console.log('\n=== VERIFYING GANPATI KIRANA SELLING CATALOG ===');
  const ganpatiCatalog = await client.query(`
    SELECT 
      v.business_name,
      COUNT(vp.id) as total_selling_items
    FROM vendors v
    JOIN vendor_products vp ON vp.vendor_id = v.id
    WHERE v.business_name ILIKE '%ganpati%'
    GROUP BY v.business_name
  `);
  console.table(ganpatiCatalog.rows);

  console.log('\n=== VERIFYING NO OTHER VENDOR HAS THESE PRODUCTS ===');
  const leakCheck = await client.query(`
    SELECT 
      v.business_name, 
      COUNT(vp.id) as count_of_these_products
    FROM vendor_products vp
    JOIN products p ON p.id = vp.product_id
    JOIN categories c ON c.id = p.category_id
    JOIN vendors v ON v.id = vp.vendor_id
    WHERE c.name IN (
      'Personal Care / Bath & Cleaning',
      'Coffee',
      'Hair / Amla / Hair Oils',
      'Tea',
      'Cooking Oils',
      'Spices & Masala',
      'Dry Fruits',
      'Rice / Flour / Grain',
      'Pulses / Dal',
      'Dairy / Sweets / Snacks',
      'Sugar / Salt / Basic Grocery',
      'Oral Care'
    )
    AND v.business_name NOT ILIKE '%ganpati%'
    GROUP BY v.business_name
  `);
  if (leakCheck.rows.length === 0) {
    console.log('✔ PASS: Exactly 0 other vendors have these products in their catalog!');
  } else {
    console.log('WARNING: Leak detected:', leakCheck.rows);
  }

  await client.end();
}

run().catch(console.error);
