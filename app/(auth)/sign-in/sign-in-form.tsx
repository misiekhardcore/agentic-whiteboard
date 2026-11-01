"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@konopskidev/ui/components/field";
import { Input } from "@konopskidev/ui/components/input";
import { Spinner } from "@konopskidev/ui/components/spinner";

import { signInAction } from "@/lib/auth-actions";
import { initialAuthState } from "@/lib/auth-form";

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(
    signInAction,
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
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
      </FieldGroup>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
