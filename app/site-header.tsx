import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";

import { Button } from "@konopskidev/ui/components/button";

import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";

/**
 * Reads the session cookie, so it can only run at request time. The root layout
 * wraps it in <Suspense> to keep the rest of the page in the static shell.
 */
async function SessionControls() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}

export function SiteHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3">
      <Link href="/" className="font-medium">
        Agentic whiteboard
      </Link>
      <Suspense fallback={null}>
        <SessionControls />
      </Suspense>
    </header>
  );
}
