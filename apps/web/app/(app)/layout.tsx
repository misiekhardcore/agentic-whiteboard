import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { signInPath } from "@/src/routes";
import { requireActor } from "@/src/server/identity/actor";

/**
 * The signed-in shell. It resolves the actor before rendering anything, so a
 * page under it can never run without one; the proxy answers the common
 * signed-out case earlier, and this is the check that does not trust a cookie's
 * presence.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireActor();
  if (session === null) redirect(signInPath("/"));

  return <>{children}</>;
}
