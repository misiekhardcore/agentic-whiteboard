import { hostname } from "node:os";

export type DocServiceConfig = {
  /** The port the room owner listens on. */
  port: number;
  /** The v2 database, which owns the schema and the document snapshot. */
  databaseUrl: string;
  /** Signs browser tokens and authenticates the app's service calls. */
  secret: string;
  /** The name other instances see when this one holds a room. */
  instanceId: string;
  /** How long a room lease stays live without a renewal. */
  leaseSeconds: number;
};

export type DocServiceEnvironment = {
  DOC_PORT?: string;
  DOC_SERVICE_SECRET?: string;
  DOC_INSTANCE_ID?: string;
  DOC_LEASE_SECONDS?: string;
  DATABASE_URL?: string;
};

const DEFAULT_PORT = 3003;
const DEFAULT_LEASE_SECONDS = 30;

/**
 * The service has no safe defaults for its secret or its database: without them
 * it cannot tell a browser token from a forgery or persist a document, so it
 * refuses to start rather than run open or empty.
 */
export function resolveDocServiceConfig(
  env: DocServiceEnvironment = process.env,
): DocServiceConfig {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required to hold document rooms");
  }

  const secret = env.DOC_SERVICE_SECRET;
  if (secret === undefined || secret.length === 0) {
    throw new Error(
      "DOC_SERVICE_SECRET is required: it signs connection tokens and authenticates the app's calls.",
    );
  }

  return {
    port: positiveInteger(env.DOC_PORT, DEFAULT_PORT, "DOC_PORT"),
    databaseUrl,
    secret,
    instanceId:
      env.DOC_INSTANCE_ID !== undefined && env.DOC_INSTANCE_ID.length > 0
        ? env.DOC_INSTANCE_ID
        : `${hostname()}:${process.pid}`,
    leaseSeconds: positiveInteger(
      env.DOC_LEASE_SECONDS,
      DEFAULT_LEASE_SECONDS,
      "DOC_LEASE_SECONDS",
    ),
  };
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.length === 0) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}
