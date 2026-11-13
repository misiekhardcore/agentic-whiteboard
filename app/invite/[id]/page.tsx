import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { auth } from "@/lib/auth";
import { getInvitationDetails } from "@/lib/organizations";
import { routes, signInPath, signUpPath } from "@/lib/routes";

import { AcceptInvitationForm } from "./accept-form";

export const metadata = {
  title: "Team invitation",
};

// The invitation is per request and must never be statically cached.
export const instant = false;

export default async function InvitationPage({
  params,
}: PageProps<"/invite/[id]">) {
  const { id } = await params;
  const invitation = await getInvitationDetails(id);

  if (!invitation) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const pending = invitation.status === "pending" && !invitation.expired;
  // Signing in or signing up from here comes back to the invitation.
  const invitationPath = routes.invite(id);

  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto bg-muted px-4 py-16">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Join {invitation.organizationName}</CardTitle>
            <CardDescription>
              {invitation.inviterName} invited{" "}
              <span className="text-foreground">{invitation.email}</span> to
              join as {invitation.role ?? "member"}.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {!pending ? (
              <Alert>
                <AlertDescription>
                  {invitation.expired
                    ? "This invitation has expired. Ask a team admin to send a new one."
                    : "This invitation is no longer pending."}
                </AlertDescription>
              </Alert>
            ) : !session ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Sign in with {invitation.email} to accept the invitation.
                </p>
                <Button asChild className="w-full">
                  <Link href={signInPath(invitationPath)}>
                    Sign in to accept
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={signUpPath(invitationPath)}>
                    Create an account
                  </Link>
                </Button>
              </>
            ) : session.user.email.toLowerCase() !==
              invitation.email.toLowerCase() ? (
              <Alert variant="destructive">
                <AlertDescription>
                  This invitation is for {invitation.email}, but you are signed
                  in as {session.user.email}. Sign in with the invited address
                  to accept.
                </AlertDescription>
              </Alert>
            ) : (
              <AcceptInvitationForm invitationId={invitation.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
