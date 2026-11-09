# Self-hosted Supabase (slim)

Postgres, PostgREST, Storage (+ imgproxy) and the Studio dashboard behind one
Envoy gateway. Supabase Auth, Realtime, Edge Functions, Supavisor and Logflare
were removed: the app handles auth with Better Auth and only needs a database,
file storage and a dashboard.

## Services

| Service    | Container            | Port                      |
| ---------- | -------------------- | ------------------------- |
| `api-gw`   | `supabase-envoy`     | `8000` (public API + Studio) |
| `db`       | `supabase-db`        | `127.0.0.1:54322`         |
| `rest`     | `supabase-rest`      | internal                  |
| `storage`  | `supabase-storage`   | internal                  |
| `imgproxy` | `supabase-imgproxy`  | internal                  |
| `meta`     | `supabase-meta`      | internal                  |
| `studio`   | `supabase-studio`    | internal                  |
| `mail`     | `supabase-mail`      | `127.0.0.1:2500` (SMTP) / `:9002` (UI), optional profile |

## Usage

```sh
docker compose up -d --wait          # or: npm run db:up
docker compose down                  # or: npm run db:down
docker compose logs -f storage
docker compose --profile mail up -d  # Inbucket SMTP catcher
```

All configuration is in `.env` in this directory. Existing database files live
in `volumes/db/data`; storage objects live in the `supabase_storage-data`
Docker volume (the file backend needs extended attributes, which Docker
Desktop's bind mounts do not support).

## Endpoints

- Studio: <http://localhost:8000> — login with `DASHBOARD_USERNAME` /
  `DASHBOARD_PASSWORD` from `.env`, then open the default project.
- REST: `http://localhost:8000/rest/v1/`
- Storage: `http://localhost:8000/storage/v1/`
- Storage S3 protocol: `http://localhost:8000/storage/v1/s3` using
  `S3_PROTOCOL_ACCESS_KEY_ID` / `S3_PROTOCOL_ACCESS_KEY_SECRET`.
- Postgres: `postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/agentic-whiteboard`

API requests take either key generation from `.env`, as the `apikey` header:

- new: `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, maps to the `anon` role)
  and `SUPABASE_SECRET_KEY` (`sb_secret_…`, maps to `service_role`);
- legacy: `ANON_KEY` / `SERVICE_ROLE_KEY` (HS256 JWTs), still accepted.

The gateway translates the opaque `sb_` keys into internal ES256 JWTs signed
with the EC key in `JWT_KEYS`; PostgREST and Storage verify them with
`JWT_JWKS`, which also carries the legacy symmetric secret so old tokens keep
working. `/rest/v1/` (the OpenAPI root) requires admin keys: `SUPABASE_SECRET_KEY`
or `SERVICE_ROLE_KEY`; the public keys get `403` there, which is expected.

Send keys in the `apikey` header. A bare `?apikey=` query parameter is only
turned into the header and then re-translated, so PostgREST rejects it with
`PGRST100` — always use the header.

## Database

There is one database, `agentic-whiteboard` (`POSTGRES_DB`), shared by the app
and every Supabase service. The repository's `DATABASE_URL` points at the same
database.

| Schema    | Owner                    | Contents                                                        |
| --------- | ------------------------ | --------------------------------------------------------------- |
| `public`  | `postgres`               | app tables, including Better Auth's `user`, `account`, `session`, `verification` and the `organization` plugin tables |
| `storage` | `supabase_storage_admin` | Storage's own tables, created by its migrations                  |
| `drizzle` | `postgres`               | Drizzle migration journal                                        |

`postgres` is kept only as the maintenance database that the image, health
checks and `psql` default to. It holds the `extensions`, `net` (pg_net) and
`vault` schemas and no application data: the GoTrue `auth` schema, the Realtime
schemas and the stale copies of the app tables from before the consolidation
were dropped.

Two consequences of serving `public` from PostgREST:

- The Better Auth tables sit in the schema `/rest/v1/` exposes. `anon` and
  `authenticated` have no privileges on them and RLS is enabled with no
  policies, so the public key gets `401` for them while the server-side
  `service_role` key keeps full access. Re-apply after a reset with
  `utils/better-auth-rls.sql` (run as `postgres`).
- `utils/app-db-grants.sql` holds the database-level grants the services need;
  it has to run as `supabase_admin`, because `postgres` cannot grant on the
  `storage` schema that the storage migrations own.

```sh
docker exec -i supabase-db psql -U supabase_admin -d agentic-whiteboard \
  < utils/app-db-grants.sql
docker exec -i supabase-db psql -U postgres -d agentic-whiteboard \
  < utils/better-auth-rls.sql
```

Studio and postgres-meta follow `POSTGRES_DB`, so the dashboard shows the live
app tables. GraphQL is not installed, hence `PGRST_DB_SCHEMAS=public`.

## API keys

Both key generations live in `.env` and work simultaneously:

| Variable                   | Postgres role  | Use                                   |
| -------------------------- | -------------- | ------------------------------------- |
| `SUPABASE_PUBLISHABLE_KEY` | `anon`         | client-side, RLS-scoped               |
| `SUPABASE_SECRET_KEY`      | `service_role` | server-side, bypasses RLS             |
| `ANON_KEY`                 | `anon`         | legacy HS256 JWT, still valid         |
| `SERVICE_ROLE_KEY`         | `service_role` | legacy HS256 JWT, still valid         |

`JWT_KEYS` (private signing JWKS) and `JWT_JWKS` (public verification JWKS)
contain the EC P-256 pair plus `JWT_SECRET` as a symmetric JWK. `JWT_KEYS` is
currently read by nothing because Supabase Auth is not running — it is kept in
sync with `JWT_JWKS` in case the auth service is ever added again.

Regenerate the whole configuration (new EC pair, new `sb_` keys, new internal
JWTs) and reload the services that consume it:

```sh
sh utils/add-new-auth-keys.sh --update-env
docker compose up -d --force-recreate api-gw rest storage
```

Notes:

- Regenerating the EC pair invalidates ES256 tokens signed with the old one.
  Nothing signs tokens here without Auth, so no sessions are affected.
- The self-hosted gateway does not implement the hosted platform's rule that
  rejects `sb_secret_…` when used from a browser (User-Agent check). Keep the
  secret key server-side yourself.

## Notes

- The gateway config is `volumes/api/envoy/`: `cds.yaml` (upstreams),
  `lds.template.yaml` (routes/filters) and `docker-entrypoint.sh` (fills
  secrets into the template). Only the four running upstreams are wired.
- Studio's Authentication section shows errors because GoTrue is not
  installed; the Table Editor shows the Better Auth tables under `public`.
  There is no `auth` schema, so policies that call `auth.uid()` would never
  match — use Better Auth sessions from the app instead.
- Better Auth mail: `npm run db:mail` starts the `mail` profile. The app sends
  verification and password reset emails to `SMTP_HOST=127.0.0.1` /
  `SMTP_PORT=2500` (see the repo's `.env`), and Inbucket shows them at
  <http://localhost:9002>. Mailboxes are named after the local part of the
  recipient address, so `ada@example.com` lands in the `ada` mailbox.
- Upgrades are manual: bump image tags in `docker-compose.yml`, then
  `docker compose pull && docker compose up -d`. `setup.sh`, `update.sh` and
  `.supabase-version` from the upstream install were removed.
