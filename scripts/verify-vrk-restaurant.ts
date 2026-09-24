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

  const restaurantId = 'f543bb14-2025-4d7f-bb2b-884c99e9c1e1';

  const catRes = await client.query(
    'SELECT COUNT(*) as total_cats FROM menu_categories WHERE restaurant_id = $1',
    [restaurantId]
  );
  const itemRes = await client.query(
    `SELECT COUNT(*) as total_items, 
            COUNT(*) FILTER (WHERE is_veg = true) as veg_items,
            COUNT(*) FILTER (WHERE is_available = true) as available_items,
            COUNT(*) FILTER (WHERE price > 0) as priced_items,
            COUNT(*) FILTER (WHERE price = 0) as zero_price_items
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.menu_category_id
     WHERE mc.restaurant_id = $1`,
    [restaurantId]
  );
  const addonRes = await client.query(
    `SELECT mia.name, mia.price, mi.name as item_name
     FROM menu_item_addons mia
     JOIN menu_items mi ON mi.id = mia.menu_item_id
     JOIN menu_categories mc ON mc.id = mi.menu_category_id
     WHERE mc.restaurant_id = $1`,
    [restaurantId]
  );
  const rotiTokriRes = await client.query(
    `SELECT mi.name, mi.price, mi.description 
     FROM menu_items mi 
     JOIN menu_categories mc ON mc.id = mi.menu_category_id 
     WHERE mc.restaurant_id = $1 AND mi.name = 'Roti ki Tokri'`,
    [restaurantId]
  );

  console.log('Categories Count:', catRes.rows[0]);
  console.log('Items Stats:', itemRes.rows[0]);
  console.log('Addons:', addonRes.rows);
  console.log('Roti ki Tokri:', rotiTokriRes.rows);

  await client.end();
}
run().catch(console.error);
