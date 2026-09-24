import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';
import { haversineKm, isVendorOpenNow } from '../src/modules/catalog/catalog.types';

const SANGOD_LAT = 24.924;
const SANGOD_LNG = 76.283;

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

  console.log('=== UPDATING SANGOD AS DEFAULT IN DATABASE ===');

  // 1. Update Ganpati Kirana
  const businessHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    isOpen: true,
    openTime: '06:00',
    closeTime: '23:30',
  }));

  const ganpatiUpdate = await client.query(`
    UPDATE vendors
    SET pickup_lat = $1, pickup_lng = $2, type = 'both', radius_km = GREATEST(radius_km, 10), is_open = true, business_hours = $3
    WHERE business_name ILIKE '%ganpati%'
    RETURNING id, business_name, type, pickup_lat, pickup_lng, radius_km, image_url
  `, [SANGOD_LAT, SANGOD_LNG, JSON.stringify(businessHours)]);
  console.log('Updated Ganpati Kirana vendor:', ganpatiUpdate.rows[0]);

  if (ganpatiUpdate.rows.length > 0) {
    const ganpati = ganpatiUpdate.rows[0];
    // Ensure Ganpati Kirana has an entry in restaurants table
    const restCheck = await client.query('SELECT id FROM restaurants WHERE vendor_id = $1', [ganpati.id]);
    if (restCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO restaurants (vendor_id, name, cuisine_tags, image_url, is_open)
        VALUES ($1, $2, $3, $4, true)
      `, [
        ganpati.id,
        ganpati.business_name,
        'Kirana, Daily Essentials, Grocery, Spices',
        ganpati.image_url || 'https://res.cloudinary.com/dwmotm3fj/image/upload/v1790072241/laoji/production/6c2692ad-bccf-41cf-98f8-366334d7ba28/business/igs58slkhxkgd73a7npz.png',
      ]);
      console.log('Inserted Ganpati Kirana into restaurants table for storefront display.');
    } else {
      await client.query(`
        UPDATE restaurants
        SET is_open = true, name = $2
        WHERE vendor_id = $1
      `, [ganpati.id, ganpati.business_name]);
      console.log('Updated existing restaurant entry for Ganpati Kirana.');
    }
  }

  // 2. Update other Sangod stores or test stores that were defaulting to Kolhapur (16.705, 74.2433)
  const otherVendorsUpdate = await client.query(`
    UPDATE vendors
    SET pickup_lat = $1, pickup_lng = $2
    WHERE (pickup_lat = 16.705 AND pickup_lng = 74.2433)
       OR (shop_address ILIKE '%sangod%')
    RETURNING id, business_name, pickup_lat, pickup_lng
  `, [SANGOD_LAT, SANGOD_LNG]);
  console.log(`Updated ${otherVendorsUpdate.rows.length} vendors to Sangod coordinates:`);
  console.table(otherVendorsUpdate.rows);

  // 3. Update default addresses that were pointing to Kolhapur fallback (16.705, 74.2433)
  const addrsUpdate = await client.query(`
    UPDATE addresses
    SET lat = $1, lng = $2,
        formatted_address = CASE 
          WHEN formatted_address ILIKE '%kolhapur%' THEN 'Main Market, Sangod - 325601'
          ELSE formatted_address
        END
    WHERE lat = 16.705 AND lng = 74.2433
    RETURNING id, formatted_address, lat, lng
  `, [SANGOD_LAT, SANGOD_LNG]);
  console.log(`Updated ${addrsUpdate.rows.length} customer addresses to Sangod:`);
  console.table(addrsUpdate.rows);

  // 4. Verify Sangod customer simulation
  console.log('\n=== VERIFYING CATALOG VISIBILITY FOR SANGOD CUSTOMER ===');
  const allVendorsRes = await client.query('SELECT * FROM vendors');
  const inRadius = allVendorsRes.rows.filter(
    (v) =>
      isVendorOpenNow({ isOpen: v.is_open, businessHours: v.business_hours }) &&
      haversineKm(SANGOD_LAT, SANGOD_LNG, v.pickup_lat, v.pickup_lng) <= v.radius_km
  );

  console.log(`Active vendors in Sangod radius (${inRadius.length}):`);
  inRadius.forEach((v) => {
    console.log(` - [${v.type}] ${v.business_name} (dist: ${haversineKm(SANGOD_LAT, SANGOD_LNG, v.pickup_lat, v.pickup_lng).toFixed(2)} km)`);
  });

  const vendorIdsNotGrocery = inRadius.filter((v) => v.type !== 'grocery').map((v) => v.id);
  const rRes = await client.query(
    `SELECT r.id, r.name, v.business_name FROM restaurants r JOIN vendors v ON v.id = r.vendor_id WHERE r.vendor_id = ANY($1)`,
    [vendorIdsNotGrocery]
  );
  console.log(`\nStorefront / Restaurants visible in customer app (${rRes.rows.length}):`);
  rRes.rows.forEach((r) => console.log(` - ${r.name}`));

  const ganpatiProductsRes = await client.query(
    `SELECT count(*) FROM vendor_products vp
     JOIN vendors v ON v.id = vp.vendor_id
     WHERE v.business_name ILIKE '%ganpati%' AND vp.vendor_id = ANY($1)`,
    [inRadius.map((v) => v.id)]
  );
  console.log(`\nGanpati Kirana products visible in customer app: ${ganpatiProductsRes.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
