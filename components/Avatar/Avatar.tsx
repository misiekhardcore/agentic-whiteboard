import { Suspense } from "react";
import {
  AvatarFallback,
  AvatarImage,
  Avatar as BaseAvatar,
} from "@konopskidev/ui/components/avatar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
      <AvatarImage
        alt={session.user.name}
        src={session.user.image ?? undefined}
      />
      <AvatarFallback>{session.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </BaseAvatar>
  );
}
