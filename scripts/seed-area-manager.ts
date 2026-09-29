import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const connStr = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: connStr });
  const { rows } = await pool.query(`SELECT * FROM area_managers`);
  console.log('Area Managers count:', rows.length);
  if (rows.length === 0) {
    const res = await pool.query(`
      INSERT INTO area_managers (name, email, phone, pincode, is_active)
      VALUES ('Chhabra Area Operations', 'areamanager.chhabra@laojionline.com', '8005803078', '325601', true)
      RETURNING *
    `);
    console.log('Inserted default Area Manager:', res.rows[0]);
  } else {
    console.log('Existing Area Managers:', rows.map(r => ({ id: r.id, name: r.name, email: r.email, pincode: r.pincode, is_active: r.is_active })));
  }
  await pool.end();
}

main().catch(console.error);
