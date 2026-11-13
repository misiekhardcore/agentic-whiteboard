"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@konopskidev/ui/components/field";
import { Input } from "@konopskidev/ui/components/input";
import { Spinner } from "@konopskidev/ui/components/spinner";
import { useActionState } from "react";

import { requestPasswordResetAction } from "@/lib/auth-actions";
import { initialAuthState } from "@/lib/auth-form";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialAuthState,
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

      {state.notice && (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      )}

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Spinner />}
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
