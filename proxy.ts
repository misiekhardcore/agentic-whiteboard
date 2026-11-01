import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const onAuthPage = isAuthPage(pathname);

  // No cookie means no session to validate, so the redirect is free.
  if (!getSessionCookie(request)) {
    return onAuthPage
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (onAuthPage) {
    return session
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  return session
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
