import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AcceptInvitationForm } from "./accept-form";

import { routes, signInPath, signUpPath } from "@/src/routes";
import { requireActor } from "@/src/server/identity/actor";
import { loadInvitation } from "@/src/server/identity/invitations";

export const metadata: Metadata = { title: "Team invitation" };
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: PageProps<"/invite/[id]">) {
  const { id } = await params;
  const invitation = await loadInvitation(id);
  if (invitation === null) notFound();

  const session = await requireActor();
  const pending = invitation.status === "pending" && !invitation.expired;
  const invitationPath = routes.invite(id);
  const invitedAsAnotherPerson =
    session !== null && session.person.email.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted px-4 py-16">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Join {invitation.organizationName}</CardTitle>
            <CardDescription>
              {invitation.inviterName} invited{" "}
              <span className="text-foreground">{invitation.email}</span> to join as{" "}
              {invitation.role}.
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
            ) : session === null ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Sign in with {invitation.email} to accept the invitation.
                </p>
                <Button asChild className="w-full">
                  <Link href={signInPath(invitationPath)}>Sign in to accept</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={signUpPath(invitationPath)}>Create an account</Link>
                </Button>
              </>
            ) : invitedAsAnotherPerson ? (
              <Alert variant="destructive">
                <AlertDescription>
                  This invitation is for {invitation.email}, but you are signed in as{" "}
                  {session.person.email}. Sign in with the invited address to accept.
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
