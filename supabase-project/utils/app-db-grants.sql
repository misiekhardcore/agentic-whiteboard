-- One-time grants for the app database that all Supabase services share.
--
-- Run as supabase_admin: `postgres` is neither superuser nor the owner of the
-- `storage` schema, so it cannot grant on objects the storage migrations
-- create. Needed after pointing `POSTGRES_DB` at the app database, because the
-- Postgres image only applies its own grants while initialising a fresh data
-- directory.
--
--   docker exec -i supabase-db psql -U supabase_admin -d agentic-whiteboard \
--     < utils/app-db-grants.sql

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO supabase_storage_admin',
    current_database()
  );
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO authenticator, dashboard_user, pgbouncer,'
    ' supabase_read_only_user, supabase_etl_admin, supabase_replication_admin,'
    ' supabase_admin',
    current_database()
  );

  -- Storage migrations create and own this schema. Requests that carry a
  -- publishable or secret key run as anon / authenticated / service_role, so
  -- those roles need USAGE on it; the table grants come from the migrations.
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role';
  END IF;
END
$$;
