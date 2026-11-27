import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { routes } from "@/src/routes";

const AUTH_PAGES: readonly string[] = [routes.signIn, routes.signUp];

/**
 * The edge gate. It reads only whether a session cookie exists — no database,
 * no session row — so it costs one redirect for the common signed-out visit and
 * is never the authority: the signed-in layout resolves the actor for real.
 *
 * It deliberately does not redirect a cookie-bearing visitor away from an auth
 * page. A session row can be gone while its cookie is still in the browser
 * (after signing out elsewhere, or after a password reset); sending that
 * visitor from `/sign-in` to `/` and back would loop. The auth layout checks the
 * session itself and redirects once when it is real.
 *
 * A protected visit remembers the exact path and query, and sign-in returns
 * there afterwards.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (AUTH_PAGES.includes(pathname)) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = new URL(routes.signIn, request.url);
  signIn.searchParams.set("redirectTo", pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/", "/w/:path*"],
};
