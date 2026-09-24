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

  const usersRes = await client.query('SELECT * FROM users ORDER BY created_at DESC');
  console.log(`=== ALL ${usersRes.rows.length} USERS ===`);
  for (const u of usersRes.rows) {
    console.log(`[${u.id}] phone: ${u.phone} | email: ${u.email} | name: ${u.name} | role: ${u.role} | created: ${u.created_at}`);
  }

  const vendorsRes = await client.query('SELECT * FROM vendors ORDER BY created_at DESC');
  console.log(`\n=== ALL ${vendorsRes.rows.length} VENDORS ===`);
  for (const v of vendorsRes.rows) {
    console.log(`[${v.id}] name: "${v.business_name}" | owner: "${v.owner_name}" | phone/user: ${v.user_id} | address: "${v.shop_address}"`);
  }

  const restRes = await client.query('SELECT * FROM restaurants');
  console.log(`\n=== ALL ${restRes.rows.length} RESTAURANTS ===`);
  for (const r of restRes.rows) {
    console.log(`[${r.id}] name: "${r.name}" | vendor: ${r.vendor_id} | rating: ${r.rating_avg} | cuisine: "${r.cuisine_tags}"`);
  }

  await client.end();
}
run().catch(console.error);
