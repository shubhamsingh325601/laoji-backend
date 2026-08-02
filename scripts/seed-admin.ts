// One-off CLI to create/reset an admin account. There is no public admin
// signup endpoint by design (TRD Section 11 permission matrix — admin is the
// most privileged role). Usage:
//   npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts <email> <password>
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { users } from '../drizzle/schema';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error('Usage: seed-admin <email> <password (min 8 chars)>');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
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

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
