-- Realtime connects with `search_path TO _realtime` before it runs its own
-- migrations, so the schema has to exist first. It owns the schema; everything
-- in it belongs to the service.
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;
