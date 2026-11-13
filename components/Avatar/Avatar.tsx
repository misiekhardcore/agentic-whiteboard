import {
  Avatar as BaseAvatar,
  AvatarFallback,
  AvatarImage,
} from "@konopskidev/ui/components/avatar";
import { headers } from "next/headers";
import { Suspense } from "react";

import { auth } from "@/lib/auth";

export function Avatar() {
  return (
    <Suspense fallback={null}>
      <AvatarInner />
    </Suspense>
  );
}

async function AvatarInner() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return (
    <BaseAvatar>
      <AvatarImage alt={session.user.name} src={session.user.image ?? undefined} />
      <AvatarFallback>{session.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </BaseAvatar>
  );
}
