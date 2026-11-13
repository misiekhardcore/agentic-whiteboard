import { Button } from "@konopskidev/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";

export async function SignButton() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return (
      <>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="primary" size="sm">
          <Link href="/sign-up">Get started</Link>
        </Button>
      </>
    );
  }

  // Signed-in people sign out from the account menu on the avatar.
  return null;
}
