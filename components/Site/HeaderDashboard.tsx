import { Button } from "@konopskidev/ui/components/button";
import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/identity/better-auth";
import { routes } from "@/lib/shared/routes";

/**
 * The way back into the app from the pages that have no sidebar.
 *
 * The landing page and the auth pages share the header but not the dashboard
 * shell, so a signed-in person who follows the brand link to `/` otherwise has
 * no route back except the account menu. Signed-out visitors get "Sign in" and
 * "Get started" from `SignButton` instead.
 */
export async function HeaderDashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={routes.dashboard}>Dashboard</Link>
    </Button>
  );
}
