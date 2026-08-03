-- Phase 11 hardening: least-privilege runtime role.
--
-- `laoji` (POSTGRES_USER in docker-compose.yml) owns this database and is
-- effectively a superuser over it — fine for running migrations (DDL), never
-- fine for the app's own runtime connection pool. This creates a second role,
-- `laoji_app`, that the running NestJS app connects as: DML only (SELECT/
-- INSERT/UPDATE/DELETE), no CREATE/ALTER/DROP, so a SQL-injection or RCE bug
-- in the app can't touch schema or other databases on the same instance.
--
-- Runs automatically on first container init (mounted into
-- /docker-entrypoint-initdb.d by docker-compose.yml) — only applies to a
-- fresh volume. On an existing local dev volume, run this file's contents
-- manually once (`docker exec -i laoji-postgres psql -U laoji -d laoji_dev <
-- scripts/init-db/01-create-app-role.sql`).
--
-- Dev-only trivial password, matching the existing laoji/laoji convention in
-- docker-compose.yml — not a production secret. Whatever manages the real
-- production role (see MIGRATIONS_DATABASE_URL / DATABASE_URL split in
-- .env.example) should use a generated one instead.

CREATE ROLE laoji_app WITH LOGIN PASSWORD 'laoji_app';

GRANT CONNECT ON DATABASE laoji_dev TO laoji_app;
GRANT USAGE ON SCHEMA public TO laoji_app;

-- Tables/sequences that already exist at the time this script runs (none, on
-- a fresh volume — migrations run after this) and any created later by the
-- owning `laoji` role (i.e. every future Drizzle migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO laoji_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO laoji_app;

ALTER DEFAULT PRIVILEGES FOR ROLE laoji IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO laoji_app;
ALTER DEFAULT PRIVILEGES FOR ROLE laoji IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO laoji_app;

-- Explicit belt-and-braces: laoji_app can never CREATE/DROP/ALTER in this
-- schema or database, even if a future GRANT elsewhere is too generous.
REVOKE CREATE ON SCHEMA public FROM laoji_app;
REVOKE CREATE ON DATABASE laoji_dev FROM laoji_app;
