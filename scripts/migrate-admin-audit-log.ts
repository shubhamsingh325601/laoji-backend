import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function main() {
  const url = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No database URL provided');
    return;
  }
  const pool = new Pool({ connectionString: url });
  try {
    const sql = readFileSync(join(__dirname, '../drizzle/migrations/0036_admin_audit_log.sql'), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) {
        console.log('Executing:', statement.trim().split('\n').find((l) => !l.startsWith('--')));
        await pool.query(statement);
      }
    }
    console.log('Migration 0036 applied successfully!');
  } catch (err) {
    console.error('Migration 0036 error:', err);
  } finally {
    await pool.end();
  }
}

main();
