"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@konopskidev/ui/components/field";
import { Input } from "@konopskidev/ui/components/input";
import { Spinner } from "@konopskidev/ui/components/spinner";
import { useActionState } from "react";

import { resetPasswordAction } from "../actions";

import { EMPTY_AUTH_FORM_STATE } from "@/src/server/identity/formState";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, EMPTY_AUTH_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
      </FieldGroup>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
