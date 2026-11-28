import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "./sign-in-form";
import { SocialSignIn } from "./social-sign-in";

import { routes, signUpPath } from "@/src/routes";
import { safeRedirectTo } from "@/src/server/identity/safeRedirectTo";

export const metadata: Metadata = { title: "Sign in" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** OAuth failures come back as `?error=<code>` from the provider callback. */
const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  account_not_linked:
    "An account with this email already exists. Sign in with your password and confirm your email before using this provider.",
  email_not_found:
    "That provider did not share an email address, so there is nothing to sign in with.",
  email_not_verified: "That provider has not verified your email address yet.",
  state_mismatch: "That sign-in attempt expired. Try again.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const redirectTo = safeRedirectTo(first(params.redirectTo));
  const passwordChanged = first(params.reset) === "1";
  const errorCode = first(params.error);
  const oauthError =
    errorCode === undefined
      ? null
      : (OAUTH_ERRORS[errorCode] ??
        "Could not sign you in with that provider. Try again or use your password.");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {passwordChanged ? (
          <Alert>
            <AlertDescription>
              Your password has been changed. Sign in with the new one.
            </AlertDescription>
          </Alert>
        ) : null}
        {oauthError !== null ? (
          <Alert variant="destructive">
            <AlertDescription>{oauthError}</AlertDescription>
          </Alert>
        ) : null}
        <SocialSignIn redirectTo={redirectTo} />
        <SignInForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="flex-col gap-3 text-sm text-muted-foreground">
        <Link
          href={routes.forgotPassword}
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Forgot your password?
        </Link>
        <div className="flex items-center justify-center gap-1">
          <span>No account yet?</span>
          <Link
            href={signUpPath(redirectTo)}
            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            Create one
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
