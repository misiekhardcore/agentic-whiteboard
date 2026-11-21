/**
 * The roots whose pages show data the session's change channels keep fresh.
 * Everything else — the marketing page, the auth utilities, an invitation —
 * either has no session or no data worth a socket.
 */
const LIVE_CHANGE_ROOTS = ["/dashboard", "/workspaces", "/workspace"] as const;

/**
 * Whether the page at `pathname` follows the change channels. Asking for a
 * channel token on a route without a session can only answer 401, which the
 * browser reports as a console error.
 */
export function followsLiveChanges(pathname: string): boolean {
  return LIVE_CHANGE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
