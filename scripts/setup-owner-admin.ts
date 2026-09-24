import 'dotenv/config';
import { Client } from 'pg';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const config = parse(connectionString);
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

  const adminRows = await client.query("SELECT id, email, password_hash FROM users WHERE role = 'admin'");
  console.log(`Found ${adminRows.rows.length} existing admin accounts in DB.`);

  let laojiAppHash = '$2b$10$G06r5eTZ9K7R8Vco7ccEOuuEK9ITqWwUiFIpEtNoxwwfFpfBtLrWe';
  for (const r of adminRows.rows) {
    if (r.email === 'admin@laoji.app' && r.password_hash) {
      laojiAppHash = r.password_hash;
    }
  }

  const ownerEmail = 'owner@laojionline.com';
  const ownerName = 'Laoji Owner';
  const ownerPhone = '8005803078';
  const ownerCity = 'Sangod';

  // Check if owner@laojionline.com already exists
  const existingOwner = await client.query(
    "SELECT id, email, role, password_hash FROM users WHERE LOWER(email) = LOWER($1)",
    [ownerEmail]
  );

  let ownerUserId: string;

  if (existingOwner.rows.length > 0) {
    ownerUserId = existingOwner.rows[0].id;
    console.log(`Found existing user with email ${ownerEmail} (id: ${ownerUserId}). Updating...`);
    await client.query(
      `UPDATE users 
       SET name = $1, phone = $2, city = $3, role = 'admin', password_hash = $4, status = 'active'
       WHERE id = $5`,
      [ownerName, ownerPhone, ownerCity, laojiAppHash, ownerUserId]
    );
    console.log('Updated existing owner account.');
  } else {
    ownerUserId = uuidv4();
    console.log(`Creating new admin account for ${ownerEmail} (id: ${ownerUserId})...`);
    await client.query(
      `INSERT INTO users (id, name, email, phone, city, timezone, role, status, password_hash, created_at) 
       VALUES ($1, $2, $3, $4, $5, 'Asia/Kolkata', 'admin', 'active', $6, NOW())`,
      [ownerUserId, ownerName, ownerEmail, ownerPhone, ownerCity, laojiAppHash]
    );
    console.log('Created owner admin account successfully.');
  }

  // Update other admin accounts' name/city without conflicting phone
  await client.query(
    `UPDATE users 
     SET name = $1, city = $2 
     WHERE role = 'admin' AND email != $3`,
    [ownerName, ownerCity, ownerEmail]
  );

  // Check/insert Sangod address for owner
  const existingAddr = await client.query(
    "SELECT id FROM addresses WHERE user_id = $1",
    [ownerUserId]
  );
  if (existingAddr.rows.length === 0) {
    const addrId = uuidv4();
    await client.query(
      `INSERT INTO addresses (id, user_id, label, formatted_address, lat, lng, is_default)
       VALUES ($1, $2, 'Office', 'Kota Road, Sangod, Rajasthan 325601', 24.924, 76.283, true)`,
      [addrId, ownerUserId]
    );
    console.log('Added default Sangod address for owner admin.');
  } else {
    await client.query(
      `UPDATE addresses 
       SET formatted_address = 'Kota Road, Sangod, Rajasthan 325601', lat = 24.924, lng = 76.283, is_default = true 
       WHERE user_id = $1`,
      [ownerUserId]
    );
    console.log('Updated Sangod address for owner admin.');
  }

  // Verify accounts in DB
  const finalCheck = await client.query(
    "SELECT id, name, email, phone, city, role, password_hash IS NOT NULL as has_password FROM users WHERE role = 'admin' ORDER BY email"
  );
  console.log('\n--- Current Active Admin Accounts in DB ---');
  for (const r of finalCheck.rows) {
    console.log(`[${r.id}] Name: "${r.name}" | Email: "${r.email}" | Phone: "${r.phone}" | City: "${r.city}" | Role: "${r.role}" | HasPassword: ${r.has_password}`);
  }

  await client.end();
  console.log('\nOwner admin setup completed successfully.');
}

run().catch((err) => {
  console.error('Error during setup:', err);
  process.exit(1);
});
