import 'dotenv/config';
import { Client } from 'pg';
import * as schema from '../drizzle/schema';
import { getTableColumns, isTable } from 'drizzle-orm';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const missingColumns: { table: string; column: string }[] = [];
  const missingTables: string[] = [];

  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value as any)) {
      const table = value as any;
      const tableName = (table as any)[Symbol.for('drizzle:Name')] || (table as any)._?.name;
      if (!tableName) continue;

      const res = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
        [tableName]
      );

      if (res.rows.length === 0) {
        missingTables.push(tableName);
        continue;
      }

      const existingCols = new Set(res.rows.map((r: any) => r.column_name));
      const cols = getTableColumns(table);

      for (const colName of Object.keys(cols)) {
        const dbColName = cols[colName].name;
        if (!existingCols.has(dbColName)) {
          missingColumns.push({ table: tableName, column: dbColName });
        }
      }
    }
  }

  console.log('--- Missing Tables ---');
  console.log(missingTables);
  console.log('--- Missing Columns ---');
  console.table(missingColumns);

  await client.end();
}

main().catch(console.error);
