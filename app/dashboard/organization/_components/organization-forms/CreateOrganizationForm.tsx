"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import { useActionState } from "react";

import { createOrganizationAction } from "@/lib/organizations/actions";
import { EMPTY_TEAM_FORM_STATE } from "@/lib/organizations/forms";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    EMPTY_TEAM_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-name">Organization name</Label>
        <Input
          id="organization-name"
          name="name"
          placeholder="Product design"
          autoComplete="organization"
          required
        />
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
