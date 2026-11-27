"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "../actions";

import { routes, signUpPath } from "@/src/routes";
import { EMPTY_AUTH_FORM_STATE } from "@/src/server/identity/formState";

export function SignInForm({
  redirectTo,
  providerFailed,
}: {
  redirectTo?: string;
  providerFailed: boolean;
}) {
  const [state, formAction, pending] = useActionState(signInAction, EMPTY_AUTH_FORM_STATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to WorkspAIce.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.values?.email}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {(state.error ?? (providerFailed ? "That provider could not sign you in." : null)) ? (
            <Alert variant="destructive">
              <AlertDescription>
                {state.error ?? "That provider could not sign you in."}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <Link href={routes.forgotPassword} className="underline underline-offset-4">
            Forgot your password?
          </Link>
          <span>
            New here?{" "}
            <Link
              href={signUpPath(redirectTo)}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Create an account
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
