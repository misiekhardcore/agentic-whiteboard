import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

export async function proxy(request: NextRequest) {
  // Without a cookie there is no session to validate, so skip the database.
  const authed =
    Boolean(getSessionCookie(request)) &&
    Boolean(await auth.api.getSession({ headers: request.headers }));

  const onAuthPage = AUTH_PAGES.includes(request.nextUrl.pathname);

  if (authed && onAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!authed && !onAuthPage) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
