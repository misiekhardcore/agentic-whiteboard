"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@konopskidev/ui/components/field";
import { Input } from "@konopskidev/ui/components/input";
import { Spinner } from "@konopskidev/ui/components/spinner";
import { useActionState } from "react";

import { requestPasswordResetAction } from "../actions";

import { EMPTY_AUTH_FORM_STATE } from "@/src/server/identity/formState";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    EMPTY_AUTH_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state.values?.email ?? ""}
            required
          />
        </Field>
      </FieldGroup>

      {state.notice ? (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      ) : null}

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
