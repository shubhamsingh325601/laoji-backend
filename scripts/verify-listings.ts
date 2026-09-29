import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';

async function verifyVendor(client: Client, vendorId: string, label: string) {
  console.log(`\n========================================`);
  console.log(`Checking listings for: ${label} (${vendorId})`);
  console.log(`========================================`);

  // Vendor record
  const vRes = await client.query('SELECT id, business_name, type, is_open, kyc_status FROM vendors WHERE id = $1', [vendorId]);
  if (vRes.rows.length === 0) {
    console.log('Vendor NOT FOUND!');
    return;
  }
  console.log('Vendor:', vRes.rows[0]);

  // Grocery vendor_products
  const vpRes = await client.query(`
    SELECT vp.id, p.name, c.name as category, vp.price, p.unit, vp.is_available
    FROM vendor_products vp
    JOIN products p ON vp.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE vp.vendor_id = $1
  `, [vendorId]);
  console.log(`Grocery vendor_products count: ${vpRes.rows.length}`);
  if (vpRes.rows.length > 0) {
    console.log('Sample grocery products:', vpRes.rows.slice(0, 3));
  }

  // Restaurant menu_items
  const rRes = await client.query('SELECT id, name, is_open, image_url, rating_avg FROM restaurants WHERE vendor_id = $1', [vendorId]);
  if (rRes.rows.length > 0) {
    const rest = rRes.rows[0];
    console.log('Restaurant:', rest);

    const miRes = await client.query(`
      SELECT mi.id, mi.name, mc.name as category, mi.price, mi.is_available
      FROM menu_items mi
      JOIN menu_categories mc ON mi.menu_category_id = mc.id
      WHERE mc.restaurant_id = $1
    `, [rest.id]);
    console.log(`Restaurant menu_items count: ${miRes.rows.length}`);
    if (miRes.rows.length > 0) {
      console.log('Sample menu items:', miRes.rows.slice(0, 3));
    }
  } else {
    console.log('No associated restaurant record.');
  }
}

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

  await verifyVendor(client, 'b82bcfdf-d8e1-4e9f-958d-942207f620ec', 'Ganpati Kirana');
  await verifyVendor(client, '5a1cd5a6-03b3-459e-9076-fb6afa3b2a03', 'VRK (Hotel & Restaurant)');

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
