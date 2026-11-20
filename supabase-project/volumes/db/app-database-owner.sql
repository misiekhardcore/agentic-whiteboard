\set appdb `echo "$POSTGRES_DB"`

-- The image creates POSTGRES_DB as supabase_admin, but the app connects as
-- postgres and has to create its own schema and tables. `public` is owned by
-- pg_database_owner, so it follows the database to the new owner.
ALTER DATABASE :"appdb" OWNER TO postgres;
