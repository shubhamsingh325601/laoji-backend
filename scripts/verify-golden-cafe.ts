import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

async function main() {
  const config = parse(process.env.DATABASE_URL!);
  const [{ address }] = await dns.lookup(config.host!, { all: true });

  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: {
      servername: config.host || undefined,
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  const v = await client.query("SELECT id, business_name, owner_name, type, kyc_status, radius_km, is_open FROM vendors WHERE business_name = 'Golden Cafe';");
  console.log('Vendor:', v.rows[0]);

  const r = await client.query("SELECT id, name, cuisine_tags, rating_avg, is_open FROM restaurants WHERE vendor_id = $1;", [v.rows[0].id]);
  console.log('Restaurant:', r.rows[0]);

  const mc = await client.query("SELECT count(*) FROM menu_categories WHERE restaurant_id = $1;", [r.rows[0].id]);
  console.log('Menu categories count:', mc.rows[0].count);

  const mi = await client.query("SELECT count(*) FROM menu_items WHERE menu_category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1);", [r.rows[0].id]);
  console.log('Menu items count:', mi.rows[0].count);

  const miv = await client.query("SELECT count(*) FROM menu_item_variants WHERE menu_item_id IN (SELECT id FROM menu_items WHERE menu_category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1));", [r.rows[0].id]);
  console.log('Menu item variants count:', miv.rows[0].count);

  const vp = await client.query("SELECT count(*) FROM vendor_products WHERE vendor_id = $1;", [v.rows[0].id]);
  console.log('Vendor products count:', vp.rows[0].count);

  const sample = await client.query("SELECT mi.name, mi.price, mv.name as variant_name, mv.price_delta FROM menu_items mi JOIN menu_item_variants mv ON mi.id = mv.menu_item_id WHERE mi.name IN ('Matar Paneer', 'Steam Momos', 'Dal Makhani') ORDER BY mi.name, mv.name;");
  console.log('Sample item variants:');
  for (const row of sample.rows) {
    console.log(`  - ${row.name}: Base Rs ${row.price} | Variant "${row.variant_name}" (Delta +Rs ${row.price_delta} = Total Rs ${Number(row.price) + Number(row.price_delta)})`);
  }

  await client.end();
}

main().catch(console.error);
