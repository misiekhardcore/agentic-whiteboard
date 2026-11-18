# Telling the interface what changed

Status: accepted
Date: 2026-11-18

## Context

Every mutation on a page ended in `revalidatePath`. A capability declared the
route paths it affected in `invalidates`, and `action()` revalidated them after a
successful call. That worked for one case — a form submitted in a server action,
whose response already re-renders the page — and failed the rest.

- An agent tool call revalidated nothing. The dashboard compensated with an
  unconditional `router.refresh()` after every turn (`components/Composer`), so a
  workspace created by the agent appeared, and a turn that changed nothing also
  re-read the page.
- A background job had no way to signal anything. Naming a conversation after
  its first prompt is exactly such a job: it writes a title while the person is
  looking at the page that shows it.
- A second tab, or a second member of an organization, never learned anything.
- On an already-dynamic page a path revalidation is only a hint to the current
  request's client router; it is not a delivery mechanism.

The path was also the wrong word. A capability does not change a route; it
changes datasets a page happens to show. Route paths made the kernel know the
site map, and made every new page a change to the capabilities it reads.

## Decisions

| Area        | Decision                                                                                                                                                  | Why                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vocabulary  | A capability declares `changes(output): Change[]`: a `key` from `CHANGE_KEYS` or a per-resource `workspace:<id>`, plus a `scope` of `person` or `account` | Datasets, not routes. `person` means the caller; `account` means the active account, which is the person themselves when it is personal.                   |
| Publication | `invoke` publishes after a successful call, `action` no longer revalidates                                                                                | One place, so a human action and an agent tool are delivered the same way. A refusal publishes nothing.                                                    |
| Transport   | Supabase Realtime private broadcast on `app:user:<id>` and `app:org:<id>`                                                                                 | The stack is already here, the topics are per-person and per-organization, and the payload is a hint rather than data.                                     |
| Payload     | The keys that changed and a timestamp, never rows                                                                                                         | The browser re-renders the route, which reads the database again. A broadcast can therefore never disagree with the truth, only be late.                   |
| Delivery    | At most once, best effort, 2 s timeout, logged and swallowed                                                                                              | Freshness is the only thing at stake. A failed broadcast must never fail the write that already committed.                                                 |     | Same-tab delivery | `action()` calls `refresh()` from `next/cache` after a successful call that declared changes; the prompt route announces its keys in `x-data-change-keys` and the composer applies them | The browser that acted already has a request in flight, so it does not wait for a socket. `refresh()` needs no path, which is what keeps the kernel from knowing the site map. |
| Client      | One subscription per session, mounted in `app/providers.tsx`; components name the keys they show (`RefreshOnChanges`, `useDataChanges`)                   | A page does not know its own path in the kernel, but it does know what it displays. The default reaction is `router.refresh()`.                            |
| Fallback    | `window.focus` and a re-subscribe both refresh the route                                                                                                  | A socket reconnects, a laptop sleeps, a tab is backgrounded. Re-reading on those edges is what makes a missed event cost freshness instead of correctness. |
| Security    | Private channels, `realtime.messages` RLS, a token minted per session                                                                                     | Realtime verifies the token and asks Postgres which topics the socket may read. The browser is told the topics; it never chooses them.                     |

### Why the token is minted here

There is no GoTrue in this stack, so nothing issues a Realtime-compatible JWT.
The route handler `GET /api/realtime/token` reads the session, and signs an HS256
token with the stack's `JWT_SECRET` carrying Better Auth's user id as `sub` and
`role: authenticated`. It returns the stack's URL, its anon key, the token and
the two topics this session may join — derived from the session, never from the
request body.

Realtime then asks `realtime.messages` whether the socket may subscribe. The
policy in `supabase-project/utils/realtime-rls.sql` allows `SELECT` on a user
topic whose id is the token's `sub`, and on an organization topic whose id the
person is a member of:

```sql
USING (
  extension = 'broadcast'
  AND (
    realtime.topic() = 'app:user:' || (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    OR (realtime.topic() LIKE 'app:org:%' AND app_private.is_org_member(…))
  )
)
```

No `INSERT` policy exists, so a browser cannot publish. The server broadcasts
with the legacy service-role JWT, which Realtime accepts and which bypasses RLS.
It has to be the legacy HS256 token and not the opaque `sb_secret_…` key: the
gateway translates the opaque key into an ES256 token, and Realtime only verifies
HS256 against `JWT_SECRET`.

### Why an unconfigured stack is not an error

A deployment without Realtime publishes nothing and warns once. Every page still
renders from the database on navigation, and focus still refreshes it: the app
is honest without a socket, rather than a stream of failed requests. That is also
why the e2e suite runs without the stack.

## Flow

1. A capability returns `{ ok: true, … }`. `invoke` maps `changes(output)` into
   `Change` values with the caller as the actor.
2. `groupChanges` picks a topic per scope: a person change always goes to the
   person; an account change goes to the organization when one is active and to
   the person's own topic otherwise. Keys are deduplicated per topic.
3. `broadcastChanges` posts one batch to `/realtime/v1/api/broadcast` through the
   gateway, privately, with a 2 s abort.
4. Realtime checks the topic policy and delivers to every socket subscribed.
5. `ChangesProvider` dispatches the keys to the handlers registered for them; a
   handler is `router.refresh()` unless a component supplied its own.

The tab that made the request does not depend on step 4. A server action's
response refreshes its own route, and a prompt's response carries the same keys
so the composer can apply them to the open page. A deployment without Realtime
still shows a person their own writes at once; only other tabs wait for focus.

## Consequences

- A change reaches a page that never made a request: another tab, another
  member's screen, an agent turn, a background job.
- The kernel no longer imports `next/cache`, and a new page needs no change to
  the capabilities it reads — only the keys it shows.
- The dashboard's blanket `router.refresh()` after a turn is gone; the turn
  declares `conversations` and `account` (`lib/ai/thread/turn/turnChanges.ts`)
  and publishes them before the model is asked, so a new conversation's pill and
  the usage meter are right while the answer is still streaming.
- A missed event is invisible until the next focus, navigation or reconnect. That
  is the accepted cost of not keeping a client copy of server data.
- Operating the stack now includes Realtime: the container, its two secrets in
  `supabase-project/.env`, the gateway routes, and `realtime-rls.sql` re-applied
  after a database reset.

## Deferred

- Presence and "who is here" on a workspace, which uses the same service.
- Per-row payloads, which would make the browser able to patch instead of
  re-read; they would also make a stale message able to show stale data.
- Publishing from the browser for optimistic UI.
