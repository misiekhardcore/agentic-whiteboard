import { createIdentityStore } from "@v2/db";
import type { IdentityStore } from "@v2/db";

let cached: IdentityStore | null = null;

/**
 * The identity reads outside better-auth's own API.
 *
 * One store for the process, built on first use: a request that resolved its
 * actor used to open a fresh pool, and a page render asks on every request, so
 * the connections piled up until the database refused them. The store owns its
 * pool for the life of the process, exactly like the app's other readers.
 */
export function identityStore(): IdentityStore {
  if (cached !== null) return cached;

  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error("DATABASE_URL is required to resolve identity");
  }

  cached = createIdentityStore(url);
  return cached;
}
