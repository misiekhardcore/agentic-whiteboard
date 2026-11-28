# Identity and sessions

**Status:** accepted · **Date:** 2026-11-27 · **Scope:** `apps/web` and `packages/db`

v2 starts every request with a person. This record fixes the four decisions that
make that true: better-auth owns identity, the actor is resolved once from the
session, a mutation acts in the account the session names, and pre-auth flows
are the documented exception to the capability rule.

## Context

The six-package skeleton had no notion of a person: every page read the seeded
demo workspace through a hard-coded actor, and the document routes authorized
that actor instead of a session. The browser could therefore open any workspace
row the demo account owned, and there was no sign-in, sign-out, reset or
invitation path to change it.

The platform record fixes the ownership: L1 is `apps/web` + better-auth
([platform-layers](platform-layers.md)). The capability layer stays pure, so
identity is an app adapter whose only output is the `UserActor` the kernel
already takes.

## Decisions

### 1. A session is a row, and the cookie is only its name

better-auth's `session` table is authoritative. Signing out deletes the row, so
a copied cookie authenticates nothing; the cookie is a lookup key, not a bearer
credential. Password reset is configured with
`revokeSessionsOnPasswordReset: true`, so every other session row is deleted in
the same transaction as the new password. A tab that was open under the old
session can no longer write.

The schema lives in `packages/db` with every other metadata table; better-auth's
drizzle adapter reads it there. Tables use better-auth's model and field names,
because the adapter looks a table up by model name and a field up by camelCase
name.

### 2. `requireActor()` is the only way a request learns who acts

`apps/web/src/server/identity/actor.ts` exports one cached function. It reads
the request headers, asks better-auth for the session row, checks the named
organization against the `member` table, and returns:

```ts
{ actor: UserActor; person: { name; email }; account: Account }
```

or `null` when signed out. A page redirects; a route handler answers 401. It
takes no arguments, so there is nothing to pass an id, account or role in, and
`resolveSessionActor` is a pure function of the session and the membership,
tested with a fake port.

A session that names an organization the person has left resolves to their
personal account rather than to a tenant they can no longer reach, so a stale
cookie cannot keep a removed member inside an organization.

`apps/web/src/server/identity/routeTable.test.ts` walks `app/api/**/route.ts`
and fails when a handler does not import `requireActor`. better-auth's own
`/api/auth/[...all]` handler is the single, explicit exemption: it authenticates
before a session exists.

### 3. The account is the tenant, not a parameter

A capability's `authorize` loads the workspace and passes it to `can`, which
compares `actor.accountId` with `workspace.accountId`. The account comes from
the session, so a workspace URL that belongs to another account is **not
found** — it never switches the session's organization to match the link.

The corollary is the render/submit race: a form rendered under account A carries
no authority; when the session now says B, the workspace it names belongs to A,
`authorize` returns `null`, and the mutation is refused before the room owner is
asked to do anything. The account is carried by the session at submit time, and
the resource is the thing that decides whether the request is in scope.

### 4. Pre-auth flows are not capabilities

Sign-up, sign-in, reset and invitation acceptance run with no actor, so they are
plain application functions (`apps/web/src/server/identity/authentication.ts`,
`invitations.ts`) behind thin `"use server"` adapters. Everything after the
session exists is a capability. This is the one exception the capability record
allows, and it is recorded here so it is a decision rather than a drift.

### 5. Uniform refusals and explicit limits

A wrong password and an unknown address both answer **"Incorrect email or
password."** The mapping lives in `authErrorMessage` and is tested; better-auth
itself answers the same code for both, and hashes the supplied password even
when no user exists, so the answer does not arrive measurably faster for an
unknown address.

Sign-in, sign-up and reset spend a sliding-window budget per address and per IP
(`rateLimit.ts`). A refusal names the retry window, so the form fails visibly
rather than silently, and a reset request answers the same whether or not the
address exists. The limiter is process-local: a multi-instance deployment needs
a shared store before this is a security control rather than a speed bump. That
is recorded as a limitation, not hidden.

### 6. The edge is optimistic; the layout is authoritative

`apps/web/proxy.ts` reads only whether a session cookie exists. It answers the
common signed-out visit with one redirect to
`/sign-in?redirectTo=<exact path and query>` and never queries the database. The
signed-in layout calls `requireActor()` for real, so a stale or forged cookie
ends at sign-in. Signed-out and signed-in pages live in separate route groups
(`(auth)` and `(app)`), so a signed-in page cannot render without an actor in
scope.

## Invitations

An invitation is a row that names one address and one role. The accept page
shows the account, the role and the inviter before the decision. Accepting
checks the pending status, the expiry and the invited address against the
session's email — case-insensitively — and then lets better-auth write the
member with the invited role and mark the invitation accepted. A replay finds no
pending invitation and is refused without a write.

Mail is an adapter: `sendIdentityMail` prints in development and refuses to log
a reset token in production without a transport. Wiring SMTP replaces that
function and nothing else.

## The identity token

A session belongs to the web app; the room owner and the agent service have no
session store. They verify an **identity token** instead: better-auth's `jwt`
plugin signs an Ed25519 JWT at `/api/auth/token`, publishes the public half as a
JWKS at `/api/auth/jwks`, and keeps the private half encrypted in the `jwks`
table with the auth secret.

The payload is the person (`sub`), the account (`accountId`, the active
organization or the person's own id) and one expiry — 15 minutes by default.
There is deliberately **no role**: a role belongs to a membership row and can
change while a token is still valid, so a token that carried one would keep
granting it. A verifier that finds a `role` claim ignores it.

`packages/identity` is the verifier, and it is pure: it imports only the
contracts and `jose`, holds no session store, database handle or framework, and
answers `null` for an expired, foreign or malformed token rather than throwing.
Its purity test walks the package source and its dependency list, so the
boundary is a failing test rather than a convention. `issuer` and `audience`
are checked when configured, with the deployment's own origin.

## Not in this slice

- The account switcher, member management and per-role navigation. This slice
  produces an actor and the membership an account switcher would later list.
- A shared rate-limit store and a real mail transport.
- The agent's message path does not exist in v2 yet. When it lands, it posts
  through `requireActor()` like every other route; the route-table test will
  fail if it does not.
