-- Better Auth keeps its tables in `public` and the app reaches them with the
-- `postgres` role through Drizzle. `public` is also the schema PostgREST serves,
-- so the same tables are reachable by the `anon` / `authenticated` roles that
-- the gateway binds the publishable key to.
--
-- Better Auth defines no policies for those roles, so enabling RLS without any
-- policy makes every row invisible over `/rest/v1/`. `postgres` and
-- `service_role` both carry BYPASSRLS, so the app and the server-side secret
-- key keep working unchanged.
--
-- Apply after the app's migrations have created the tables:
--   docker exec -i supabase-db psql -U postgres -d agentic-whiteboard \
--     < utils/better-auth-rls.sql

ALTER TABLE public."user"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation   ENABLE ROW LEVEL SECURITY;

-- Belt and braces: no policy exists for these roles, and no grant should either.
REVOKE ALL ON
  public."user",
  public.account,
  public.session,
  public.verification,
  public.organization,
  public.member,
  public.invitation
FROM anon, authenticated;

-- The server-side secret key (`service_role`) is meant to be the admin key, as
-- on hosted Supabase. Tables Drizzle creates later inherit these privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
