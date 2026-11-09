import { auth } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";
import { Button } from "@konopskidev/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";

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

  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
