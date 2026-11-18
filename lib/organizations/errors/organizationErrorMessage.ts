import { APIError } from "better-auth/api";

import { MESSAGES } from "./internals";

/**
 * Turns a Better Auth error into a sentence a person can act on. Codes we do
 * not know keep the caller's fallback, so internal details stay on the server.
 */
export function organizationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (error.body?.message) return error.body.message;
  }

  return fallback;
}
