"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@konopskidev/ui/components/field";
import { Input } from "@konopskidev/ui/components/input";
import { Spinner } from "@konopskidev/ui/components/spinner";
import { useActionState } from "react";

import { signUpAction } from "../actions";

import { EMPTY_AUTH_FORM_STATE } from "@/src/server/identity/formState";

export function SignUpForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, EMPTY_AUTH_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            defaultValue={state.values?.name ?? ""}
            required
          />
        </Field>
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
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
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
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
