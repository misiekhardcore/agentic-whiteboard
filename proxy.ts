import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { DEFAULT_REDIRECT, safeRedirectTo } from "@/lib/auth-redirect";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

export async function proxy(request: NextRequest) {
  // Without a cookie there is no session to validate, so skip the database.
  const authed =
    Boolean(getSessionCookie(request)) &&
    Boolean(await auth.api.getSession({ headers: request.headers }));

  const onAuthPage = AUTH_PAGES.includes(request.nextUrl.pathname);
  const requested = safeRedirectTo(request.nextUrl.searchParams.get("redirectTo"));

  if (authed && onAuthPage) {
    return NextResponse.redirect(new URL(requested ?? DEFAULT_REDIRECT, request.url));
  }

  if (!authed && !onAuthPage) {
    // Remember where they were headed, including the query string.
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set(
      "redirectTo",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
