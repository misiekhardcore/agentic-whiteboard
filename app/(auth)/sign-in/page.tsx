import Link from "next/link";

import {
  Alert,
  AlertDescription,
} from "@konopskidev/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { safeRedirectTo } from "@/lib/auth-redirect";

import { SignInForm } from "./sign-in-form";
import { type SocialProvider, SocialSignIn } from "./social-sign-in";

/** Matches lib/auth.ts: a provider exists only when both values are set. */
function enabledProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
  ) {
    providers.push("github");
  }
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  ) {
    providers.push("google");
  }
  return providers;
}

/** OAuth failures come back as ?error=<code> from the Better Auth callback. */
const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  account_not_linked:
    "An account with this email already exists. Sign in with your password and confirm your email before using this provider.",
  email_not_found:
    "That provider did not share an email address, so there is nothing to sign in with.",
  email_not_verified:
    "That provider has not verified your email address yet.",
  state_mismatch: "That sign-in attempt expired. Try again.",
};

export const metadata = {
  title: "Sign in",
};

// The page reads ?redirectTo, so it renders per request instead of prerendering.
export const instant = false;

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const redirectTo = safeRedirectTo(params.redirectTo);
  const passwordChanged = params.reset === "1";
  const errorCode = Array.isArray(params.error)
    ? params.error[0]
    : params.error;
  const oauthError = errorCode
    ? (OAUTH_ERRORS[errorCode] ??
      "Could not sign you in with that provider. Try again or use your password.")
    : null;
  const providers = enabledProviders();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Enter your details to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {passwordChanged && (
          <Alert>
            <AlertDescription>
              Your password has been changed. Sign in with the new one.
            </AlertDescription>
          </Alert>
        )}
        {oauthError && (
          <Alert variant="destructive">
            <AlertDescription>{oauthError}</AlertDescription>
          </Alert>
        )}
        {providers.length > 0 && (
          <>
            <SocialSignIn
              providers={providers}
              redirectTo={redirectTo}
            />
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <SignInForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="flex-col gap-3 text-sm text-muted-foreground">
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          Forgot your password?
        </Link>
        <div className="flex items-center justify-center gap-1">
          <span>No account yet?</span>
          <Link
            href={
              redirectTo
                ? `/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`
                : "/sign-up"
            }
            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            Create one
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
