import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations run DDL, so this must be the schema-owner role, not the
    // least-privilege DATABASE_URL the running app connects as (Phase 11
    // hardening — see .env.example).
    url: process.env.MIGRATIONS_DATABASE_URL ?? 'postgres://laoji:laoji@localhost:5433/laoji_dev',
  },
});
