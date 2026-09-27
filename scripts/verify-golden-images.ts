import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

async function verify() {
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

  const r = await client.query("SELECT id, name FROM restaurants WHERE name ILIKE '%Golden Cafe%'");
  const restaurantId = r.rows[0]?.id;

  const res = await client.query(`
    SELECT mi.id, mi.name, mi.image_url, mc.name as cat_name
    FROM menu_items mi
    JOIN menu_categories mc ON mi.menu_category_id = mc.id
    WHERE mc.restaurant_id = $1 AND mi.image_url LIKE '%cloudinary%'
    ORDER BY mc.sort_order, mi.name
  `, [restaurantId]);

  console.log(`\nVerified: ${res.rows.length} Golden Cafe items now have Cloudinary image URLs in DB!`);
  console.log('Sample updated items:');
  for (const item of res.rows.slice(0, 15)) {
    console.log(`  - ${item.name} (${item.cat_name}): ${item.image_url}`);
  }

  await client.end();
}
verify().catch(console.error);
