import { createHmac, timingSafeEqual } from "node:crypto";

import { WORKSPACE_PERMISSIONS, type WorkspacePermission } from "@/lib/collab/contracts";

const HEADER = { alg: "HS256", typ: "JWT" } as const;

export function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signatureOf(header: string, body: string, secret: string): string {
  return base64Url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
}

export function signPayload(payload: unknown, secret: string): string {
  const header = base64Url(JSON.stringify(HEADER));
  const body = base64Url(JSON.stringify(payload));

  return `${header}.${body}.${signatureOf(header, body, secret)}`;
}

/** The three token parts, or nothing when the value is not shaped like one. */
export function splitToken(token: string): [string, string, string] | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  if (!header || !body || !signature) return null;

  return [header, body, signature];
}

/** Compares two signatures without leaking where they first differ. */
export function signatureMatches(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);

  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export function readJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64").toString("utf8"));

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function isWorkspacePermission(value: unknown): value is WorkspacePermission {
  return WORKSPACE_PERMISSIONS.some((permission) => permission === value);
}
