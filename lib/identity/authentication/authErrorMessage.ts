import { APIError } from "better-auth/api";

import { MESSAGES } from "./internals";

/** A sentence a person can act on; unknown codes keep the caller's fallback. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = error.body?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
  }

  return fallback;
}
