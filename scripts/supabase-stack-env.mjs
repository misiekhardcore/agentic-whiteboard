#!/usr/bin/env node
/**
 * Writes the throwaway configuration a fresh self-hosted stack needs, and can
 * print the matching app variables for CI.
 *
 * The realtime e2e job starts its own stack, so nothing here is a secret: every
 * value is a fixed test value, and the two legacy API keys are signed with the
 * generated `JWT_SECRET` the way the stack's own setup signs them.
 *
 *   node scripts/supabase-stack-env.mjs              # write supabase-project/.env
 *   node scripts/supabase-stack-env.mjs --app-env    # also print KEY=value lines
 */
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stackEnvPath = join(repositoryRoot, "supabase-project", ".env");
const wantsAppEnv = process.argv.includes("--app-env");

/** Long enough for HS256, and shared by the app, the gateway and Realtime. */
const JWT_SECRET = "e2e-realtime-stack-jwt-secret-0123456789abcdef";
const POSTGRES_PASSWORD = "postgres";
const POSTGRES_DB = "agentic-whiteboard";
const GATEWAY_PORT = "8000";
/** 2100-01-01: the keys never expire inside a job that lasts minutes. */
const JWT_EXPIRY_AT = 4_102_444_800;

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function legacyKey(role) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({ role, iss: "supabase", iat: JWT_EXPIRY_AT, exp: JWT_EXPIRY_AT }),
  );
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest();

  return `${header}.${payload}.${toBase64Url(signature)}`;
}

const serviceRoleKey = legacyKey("service_role");
const anonymousKey = legacyKey("anon");

const stackEnv = [
  ["POSTGRES_HOST", "db"],
  ["POSTGRES_PORT", "5432"],
  ["POSTGRES_EXPOSED_PORT", "54322"],
  ["POSTGRES_DB", POSTGRES_DB],
  ["POSTGRES_PASSWORD", POSTGRES_PASSWORD],
  ["JWT_EXPIRY", "3600"],
  ["JWT_SECRET", JWT_SECRET],
  ["API_GW_HTTP_PORT", GATEWAY_PORT],
  ["SUPABASE_PUBLIC_URL", `http://localhost:${GATEWAY_PORT}`],
  ["DASHBOARD_USERNAME", "supabase"],
  ["DASHBOARD_PASSWORD", "supabase"],
  ["ANON_KEY", anonymousKey],
  ["SERVICE_ROLE_KEY", serviceRoleKey],
  // Realtime refuses to boot unless this key is exactly 16 characters.
  ["REALTIME_DB_ENC_KEY", "e2e-realtime-enc"],
  // Realtime refuses to boot with fewer than 64 characters.
  [
    "SECRET_KEY_BASE",
    "e2e-realtime-secret-key-base-0123456789abcdef0123456789abcdef0123456789abcdef",
  ],
]
  .map(([name, value]) => `${name}=${value}`)
  .join("\n");

writeFileSync(stackEnvPath, `${stackEnv}\n`);

if (wantsAppEnv) {
  const appEnv = [
    ["DATABASE_URL", `postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:54322/${POSTGRES_DB}`],
    ["SUPABASE_URL", `http://127.0.0.1:${GATEWAY_PORT}`],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${GATEWAY_PORT}`],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonymousKey],
    ["JWT_SECRET", JWT_SECRET],
    ["BETTER_AUTH_SECRET", "e2e-only-secret-0123456789abcdef"],
    ["BETTER_AUTH_URL", "http://localhost:3000"],
    ["SMTP_HOST", "127.0.0.1"],
    ["SMTP_PORT", "2500"],
    ["SMTP_FROM", "Agentic Whiteboard <no-reply@localhost>"],
  ];

  process.stdout.write(`${appEnv.map(([name, value]) => `${name}=${value}`).join("\n")}\n`);
}
