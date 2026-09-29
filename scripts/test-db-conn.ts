import 'dotenv/config';
import { Pool } from 'pg';

async function test() {
  const connStr = process.env.DATABASE_URL || 'postgres://laoji_app:laoji_app@localhost:5433/laoji_dev';
  console.log('Connecting to:', connStr.replace(/:[^:@]+@/, ':***@'));
  const pool = new Pool({ connectionString: connStr });
  try {
    const res = await pool.query('SELECT 1 as result');
    console.log('Database connected successfully! Result:', res.rows);
  } catch (err: any) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

test();
