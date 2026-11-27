"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Spinner } from "@konopskidev/ui/components/spinner";
import { useActionState } from "react";

import { acceptInvitationAction } from "./actions";

import { EMPTY_AUTH_FORM_STATE } from "@/src/server/identity/formState";

export function AcceptInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    EMPTY_AUTH_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}
