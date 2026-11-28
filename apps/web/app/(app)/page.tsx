import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { signOutAction } from "./actions";

import { requireActor } from "@/src/server/identity/actor";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireActor();
  // The layout already refused a signed-out visit; this narrows the type and
  // keeps the page honest if it is ever rendered outside that layout.
  if (session === null) return null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Hello, {session.person.name}</CardTitle>
          <CardDescription>
            {session.account.organizationId === null
              ? "You are acting in your personal account."
              : "You are acting in a shared account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Person</dt>
              <dd className="font-medium">{session.person.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account</dt>
              <dd className="font-medium">{session.account.id}</dd>
            </div>
          </dl>

          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
