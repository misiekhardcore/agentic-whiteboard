import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { routes } from "@/src/routes";
import { requireActor } from "@/src/server/identity/actor";

/**
 * The signed-out shell. It holds no actor of its own; it only checks whether
 * one exists, so a signed-in visitor is sent home by a real session read rather
 * than by a cookie's presence.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await requireActor()) redirect(routes.home);

  return (
    // A short window (or a browser password manager) would otherwise clip a
    // form taller than the viewport, so the auth shell scrolls itself.
    <main className="flex min-h-svh items-center justify-center overflow-y-auto bg-muted px-4 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
