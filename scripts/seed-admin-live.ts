// One-off CLI to create/reset an admin account on the live (Neon) database.
// Same behavior as seed-admin.ts, but with a connection that resolves the
// host to IPv4 and passes the TLS servername explicitly — the raw pool
// connection string can hang on Neon's mixed IPv4/IPv6 address list.
// Usage:
//   npx ts-node -r tsconfig-paths/register scripts/seed-admin-live.ts <email> <password>
// Connection comes from LIVE_DATABASE_URL (defaults to DATABASE_URL).
import 'dotenv/config';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';
import { users } from '../drizzle/schema';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error('Usage: seed-admin-live <email> <password (min 8 chars)>');
    process.exit(1);
  }

  const connectionString = process.env.LIVE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing LIVE_DATABASE_URL (or DATABASE_URL) in .env');
    process.exit(1);
  }

  const config = parse(connectionString);
  if (!config.host || !config.user) {
    console.error('Unable to parse connection string');
    process.exit(1);
  }

  const [{ address }] = await dns.lookup(config.host, { all: true });
  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl:
      config.sslmode === 'require' ||
      config.sslmode === 'verify-ca' ||
      config.sslmode === 'verify-full' ||
      (config.ssl as boolean | undefined) === true
        ? {
            servername: config.host,
            rejectUnauthorized: false,
          }
        : undefined,
    connectionTimeoutMillis: 30_000,
  });

  await client.connect();
  const db = drizzle(client);
  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
    console.log(`Updated password for existing admin ${email}`);
  } else {
    await db.insert(users).values({ email, passwordHash, role: 'admin' });
    console.log(`Created admin ${email}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
