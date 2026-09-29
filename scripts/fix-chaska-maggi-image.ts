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

  console.log('Connected to PostgreSQL.');

  // Pure vegetarian noodles/Maggi image (no egg)
  const pureVegMaggiImage = 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500';

  const updateRes = await client.query(`
    UPDATE menu_items
    SET image_url = $1
    WHERE image_url ILIKE '%1612927601601%'
    RETURNING id, name, image_url
  `, [pureVegMaggiImage]);

  console.log(`Replaced egg image on ${updateRes.rows.length} total items in DB:`);
  for (const item of updateRes.rows) {
    console.log(`  - [${item.id}] ${item.name} -> ${item.image_url}`);
  }

  // Also check if any seed files have this image and update scripts/seed-new-vendors.ts & scripts/seed-golden-cafe.ts
  await client.end();
}

run().catch(console.error);
