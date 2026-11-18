-- Who may read the app's change events.
--
-- The app broadcasts on private channels, so Realtime asks
-- `realtime.messages` policies whether the socket's JWT may subscribe. There is
-- no GoTrue in this stack: the app mints the token itself (lib/identity/realtimeToken.ts)
-- and puts Better Auth's user id in `sub`, so claims are read from the request
-- settings rather than `auth.uid()`.
--
-- Two topics exist, both owned by lib/shared/changes/topics.ts:
--   app:user:<userId>  - the person's own conversations and prompts
--   app:org:<orgId>    - everything visible to one organization's members
--
-- Only SELECT is granted: a browser may listen, never publish. The server
-- broadcasts with the secret key, which bypasses RLS.
--
-- Apply after the stack is up:
--   docker exec -i supabase-db psql -U postgres -d agentic-whiteboard \
--     < utils/realtime-rls.sql

-- Realtime runs its own migrations here on first boot and cannot create the
-- schema itself: it connects with `search_path TO _realtime` before migrating.
-- The db init script creates it on a fresh cluster; this covers one that was
-- initialized before that script existed.
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;

-- Membership is a `public.member` row. The lookup runs as the definer because
-- `authenticated` is granted nothing on Better Auth's tables
-- (utils/better-auth-rls.sql revokes it); the function answers one boolean.
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.is_org_member(organization_id text, user_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member
    WHERE organization_id = is_org_member.organization_id
      AND user_id = is_org_member.user_id
  );
$$;

REVOKE ALL ON FUNCTION app_private.is_org_member(text, text) FROM public;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_org_member(text, text) TO authenticated;

GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT SELECT ON realtime.messages TO authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own and organization changes" ON realtime.messages;

CREATE POLICY "read own and organization changes"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND (
    realtime.topic() = 'app:user:' || (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    OR (
      realtime.topic() LIKE 'app:org:%'
      AND app_private.is_org_member(
        substring(realtime.topic() FROM 9),
        current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
      )
    )
  )
);
