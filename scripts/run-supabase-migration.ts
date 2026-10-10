import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const argConn = process.argv[2];
  const connectionString =
    argConn ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: No database connection string provided.');
    console.error('');
    console.error('Usage:');
    console.error('  npx ts-node -r tsconfig-paths/register scripts/run-supabase-migration.ts "<connection_string>"');
    console.error('Or set SUPABASE_DATABASE_URL in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to target database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to database!');

    const sqlFilePath = path.join(__dirname, '..', 'drizzle', 'supabase_migration_bundle.sql');
    const fullSql = fs.readFileSync(sqlFilePath, 'utf8');

    // Remove comments and split into runnable blocks
    const lines = fullSql.split('\n');
    let currentStatement = '';
    const statements: string[] = [];
    let insideDoBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }

      if (trimmed.startsWith('DO $$')) {
        insideDoBlock = true;
      }

      currentStatement += line + '\n';

      if (insideDoBlock) {
        if (trimmed.endsWith('END $$;')) {
          insideDoBlock = false;
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      } else {
        if (trimmed.endsWith(';')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`🚀 Executing ${statements.length} migration statements...\n`);

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.split('\n')[0].slice(0, 80);
      try {
        await client.query(stmt);
        console.log(`[${i + 1}/${statements.length}] ✅ Success: ${preview}`);
        passed++;
      } catch (err: any) {
        console.error(`[${i + 1}/${statements.length}] ⚠️  Notice/Error: ${preview}`);
        console.error(`   Message: ${err?.message || err}\n`);
        failed++;
      }
    }

    console.log('\n========================================');
    console.log(`🎉 Migration Completed: ${passed} succeeded, ${failed} notices/errors.`);
    console.log('========================================');
  } catch (err: any) {
    console.error('❌ Connection or execution failed:', err?.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Unexpected failure:', err);
  process.exit(1);
});
