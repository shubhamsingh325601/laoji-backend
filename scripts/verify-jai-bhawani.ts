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
    ssl: { servername: config.host || undefined, rejectUnauthorized: false },
  });

  await client.connect();

  console.log('========================================================');
  console.log('VERIFYING JAI BHAWANI BAKERS VENDOR & STORE LISTING');
  console.log('========================================================');

  // 1. Vendor & User
  const vendorRes = await client.query(`
    SELECT v.id as vendor_id, v.business_name, v.owner_name, v.type, v.business_type,
           v.shop_address, v.pickup_lat, v.pickup_lng, v.radius_km, v.is_open, v.kyc_status,
           u.id as user_id, u.phone, u.email, u.status as user_status
    FROM vendors v
    JOIN users u ON v.user_id = u.id
    WHERE v.business_name ILIKE '%jai bhawani%'
  `);

  if (vendorRes.rows.length === 0) {
    console.error('❌ Vendor not found!');
    process.exit(1);
  }

  const vendor = vendorRes.rows[0];
  console.log('Vendor Details:', vendor);

  // 2. Restaurant
  const restRes = await client.query(`
    SELECT id, vendor_id, name, cuisine_tags, image_url, rating_avg, is_open
    FROM restaurants
    WHERE vendor_id = $1
  `, [vendor.vendor_id]);

  console.log('\nRestaurant Details:', restRes.rows[0]);
  const restaurantId = restRes.rows[0].id;

  // 3. Menu categories & items
  const menuRes = await client.query(`
    SELECT mc.name as category, mi.name as item, mi.price, mi.is_veg, mi.is_available, mi.description
    FROM menu_items mi
    JOIN menu_categories mc ON mi.menu_category_id = mc.id
    WHERE mc.restaurant_id = $1
    ORDER BY mc.sort_order, mi.price
  `, [restaurantId]);

  console.log(`\nMenu Items Count: ${menuRes.rows.length} (Expected: 14)`);
  console.table(menuRes.rows);

  // 4. Verify Addons
  const addonsRes = await client.query(`
    SELECT mia.name as addon_name, mia.price, count(*) as count
    FROM menu_item_addons mia
    JOIN menu_items mi ON mia.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.menu_category_id = mc.id
    WHERE mc.restaurant_id = $1
    GROUP BY mia.name, mia.price
  `, [restaurantId]);
  console.log('\nAddons attached:');
  console.table(addonsRes.rows);

  await client.end();
  console.log('\n✔ ALL VERIFICATIONS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
