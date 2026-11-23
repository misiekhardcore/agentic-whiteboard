#!/usr/bin/env node
/**
 * Creates the private bucket stored media lives in, or reports that it already
 * exists. Storage is a service in the local stack, so the bucket is a row its
 * own API owns rather than something the app's migrations create.
 *
 *   pnpm media:bucket
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.MEDIA_BUCKET?.trim() || "media";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set before the media bucket can be created.",
  );
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({ id: bucket, name: bucket, public: false }),
});

const body = await response.text();

if (response.ok) {
  console.log(`Created the private "${bucket}" bucket.`);
  process.exit(0);
}

// Storage answers with a duplicate-resource error rather than a 409 here.
if (/already exists/i.test(body)) {
  console.log(`The "${bucket}" bucket already exists.`);
  process.exit(0);
}

console.error(`Creating the "${bucket}" bucket failed with status ${response.status}: ${body}`);
process.exit(1);
