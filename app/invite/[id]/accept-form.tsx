"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { useActionState } from "react";

import { acceptInvitationAction } from "@/lib/organization-actions";
import { EMPTY_TEAM_FORM_STATE } from "@/lib/organization-form";

export function AcceptInvitationForm({
  invitationId,
}: {
  invitationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    EMPTY_TEAM_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) }
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}
