import type { RefusalCode } from "@v2/contracts";

/**
 * The HTTP answer a refused document call gets. Both document routes map the
 * same refusal codes, so the mapping lives here rather than in each route.
 */
export function statusOf(code: RefusalCode): number {
  switch (code) {
    case "not-found":
      return 404;
    case "read-only":
      return 409;
    case "unavailable":
      return 503;
    default:
      return 400;
  }
}
